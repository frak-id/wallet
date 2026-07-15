import { log } from "@backend-infrastructure";
import {
    getTokenAddressForStablecoin,
    type Stablecoin,
} from "@frak-labs/app-essentials";
import type { Address, Hex } from "viem";
import type {
    BillingDocumentInsert,
    BillingDocumentSelect,
} from "../../domain/billing/db/schema";
import type { BillingDocumentRepository } from "../../domain/billing/repositories/BillingDocumentRepository";
import type { BillingStorageRepository } from "../../domain/billing/repositories/BillingStorageRepository";
import type { BillingDocumentDetails } from "../../domain/billing/schemas";
import type { BillingComputationService } from "../../domain/billing/services/BillingComputationService";
import type { BillingPdfService } from "../../domain/billing/services/pdf";
import type { MerchantRepository } from "../../domain/merchant/repositories/MerchantRepository";
import type { AssetLogRepository } from "../../domain/rewards/repositories/AssetLogRepository";
import { eventEmitter } from "../../infrastructure/messaging/events";
import type { PricingRepository } from "../../infrastructure/pricing/PricingRepository";
import { buildPdfBuyer } from "./shared";

export class DepositNotFoundError extends Error {
    constructor(depositId: string) {
        super(`Linked deposit ${depositId} not found for this merchant`);
    }
}

/**
 * The fiat leg each stablecoin is pegged to — the common unit reward tokens
 * are converted through when the withdraw's linked deposit is in this
 * currency (§4). Kept local to this orchestrator: it's the only place that
 * needs to pick a single `TokenPrice` leg for the withdraw-restitution
 * conversion.
 */
const STABLECOIN_FIAT_LEG: Record<Stablecoin, "eur" | "usd" | "gbp"> = {
    eure: "eur",
    gbpe: "gbp",
    usde: "usd",
    usdc: "usd",
};

function fiatKeyForStablecoin(currency: Stablecoin): "eur" | "usd" | "gbp" {
    return STABLECOIN_FIAT_LEG[currency];
}

/**
 * Any withdraw-input validation failure (wrong/voided linked deposit, kind
 * mismatch, currency mismatch). Collapsed into one class since all three
 * map to the same 400 response and callers never need to distinguish them
 * individually — only the message differs.
 */
export class WithdrawValidationError extends Error {}

type CreateDepositInput = {
    grossAmount: string;
    currency: Stablecoin;
    documentDate: Date;
    country: string;
    /** Offered top-up added back to the net (§4). Defaults to "0". */
    giftedAmount?: string;
    paymentPlatform?: "shopify" | "stripe";
    note?: string;
    txHash?: Hex;
};

type CreateWithdrawInput = {
    remainingBankAmount: string;
    currency: Stablecoin;
    documentDate: Date;
    linkedDepositId: string;
    rawIban: string;
    note?: string;
    txHash?: Hex;
};

/**
 * The only place that reads across the billing / merchant / rewards domains
 * to assemble a deposit or withdraw document (flow rule: cross-domain reads
 * go through an orchestrator, never service -> service or repository ->
 * service — see AGENTS.md). `BillingComputationService` and `BillingPdfService`
 * stay domain-pure; this orchestrator is the one that hands them primitives
 * and assembled DTOs.
 *
 * PDF generation runs synchronously after the document row commits. If
 * render/upload fails, the document row still exists (with a reference and
 * frozen `details`, but `pdfGeneratedAt IS NULL`) — this is a recoverable
 * state, not a rollback target (S3 writes aren't transactional with
 * Postgres). `regeneratePdf` can be called again for that document id.
 */
export class BillingOrchestrator {
    constructor(
        private readonly billingDocuments: BillingDocumentRepository,
        private readonly billingStorage: BillingStorageRepository,
        private readonly merchant: MerchantRepository,
        private readonly assetLogs: AssetLogRepository,
        private readonly computation: BillingComputationService,
        private readonly pdf: BillingPdfService,
        private readonly pricing: PricingRepository
    ) {}

    async createDeposit(
        merchantId: string,
        input: CreateDepositInput,
        createdBy: string | null
    ): Promise<BillingDocumentSelect> {
        const { vatAmount, frakFeeAmount, giftedAmount, netAmount } =
            this.computation.computeDeposit({
                grossAmount: input.grossAmount,
                country: input.country,
                giftedAmount: input.giftedAmount,
            });

        const details: BillingDocumentDetails = {
            kind: "deposit",
            vatAmount,
            frakFeeAmount,
            giftedAmount,
            paymentPlatform: input.paymentPlatform,
            note: input.note,
        };

        const document = await this.billingDocuments.create({
            merchantId,
            kind: "deposit",
            documentDate: input.documentDate,
            currency: input.currency,
            grossAmount: input.grossAmount,
            netAmount,
            txHash: input.txHash,
            details,
            createdBy,
        } satisfies Omit<BillingDocumentInsert, "reference">);

        // PDF is generated lazily on first download (see `regeneratePdf` +
        // the download route), not here — a merchant who never downloads a
        // deposit note never triggers a render or a stored object.
        // A new deposit (possibly back-dated) shifts the derived ledger of
        // every monthly bill covering its date, so invalidate their cached
        // PDFs to force a fresh render on next access.
        await this.invalidateMonthlyBillsCovering(
            merchantId,
            document.documentDate
        );

        // Wake the monthly-bill sweep so a new (possibly back-dated) deposit
        // gets its missing bills generated on demand rather than waiting for
        // the daily cron. Not merchant-scoped — the sweep walks every merchant.
        eventEmitter.emit("newDeposit");

        return document;
    }

    async createWithdraw(
        merchantId: string,
        input: CreateWithdrawInput,
        createdBy: string | null
    ): Promise<BillingDocumentSelect> {
        const linkedDeposit = await this.billingDocuments.findById(
            merchantId,
            input.linkedDepositId
        );
        if (!linkedDeposit) {
            throw new DepositNotFoundError(input.linkedDepositId);
        }
        if (linkedDeposit.kind !== "deposit") {
            throw new WithdrawValidationError(
                `Document ${input.linkedDepositId} is not a deposit`
            );
        }
        if (linkedDeposit.voidedAt) {
            throw new WithdrawValidationError(
                `Linked deposit ${input.linkedDepositId} is voided`
            );
        }
        if (linkedDeposit.details?.kind !== "deposit") {
            throw new WithdrawValidationError(
                `Document ${input.linkedDepositId} is not a deposit`
            );
        }
        if (linkedDeposit.currency !== input.currency) {
            throw new WithdrawValidationError(
                `Withdraw currency does not match linked deposit ${input.linkedDepositId}'s currency`
            );
        }

        const rewardsDistributedSinceDeposit =
            await this.sumRewardsInDepositCurrency(
                merchantId,
                linkedDeposit.documentDate,
                input.currency
            );

        const { distributedRatio, restitutedVat, restitutedFrakFee, bankSent } =
            this.computation.computeWithdraw({
                remainingBankAmount: input.remainingBankAmount,
                linkedDepositNetAmount: linkedDeposit.netAmount ?? "0",
                linkedDepositVatAmount: linkedDeposit.details.vatAmount,
                linkedDepositFrakFeeAmount: linkedDeposit.details.frakFeeAmount,
                rewardsDistributedSinceDeposit,
            });

        const maskedIban = this.computation.maskIban(input.rawIban);

        const details: BillingDocumentDetails = {
            kind: "withdraw",
            remainingBankAmount: input.remainingBankAmount,
            distributedRatio,
            restitutedVat,
            restitutedFrakFee,
            bankSent,
            maskedIban,
            note: input.note,
        };

        const document = await this.billingDocuments.create({
            merchantId,
            kind: "withdraw",
            documentDate: input.documentDate,
            currency: input.currency,
            grossAmount: input.remainingBankAmount,
            netAmount: bankSent,
            txHash: input.txHash,
            linkedDepositId: input.linkedDepositId,
            details,
            createdBy,
        } satisfies Omit<BillingDocumentInsert, "reference">);

        // PDF generated lazily on first download (see `createDeposit`). A
        // withdraw's `bankSent` also enters the ledger, so invalidate the
        // covering monthly bills the same way.
        await this.invalidateMonthlyBillsCovering(
            merchantId,
            document.documentDate
        );

        return document;
    }

    /**
     * Sum of settled rewards since `since`, converted into `depositCurrency`'s
     * unit — the numerator of the withdraw distributed ratio (§4). A merchant
     * can reward in multiple stablecoins; summing raw token amounts across
     * currencies would inflate the ratio of a single-currency withdraw and
     * under-restitute VAT/fee. Prices are looked up here (orchestrator owns
     * pricing); the per-token factor is `otherPrice / depositPrice` in the
     * deposit currency's fiat leg, so the deposit's own token resolves to a
     * factor of exactly `1` (1:1). Unpriced tokens are left out of the map and
     * contribute 0 in the repository's `CASE ... ELSE 0`.
     */
    private async sumRewardsInDepositCurrency(
        merchantId: string,
        since: Date,
        depositCurrency: Stablecoin
    ): Promise<string> {
        const tokens = await this.assetLogs.distinctSettledTokensSince(
            merchantId,
            since
        );
        if (tokens.length === 0) return "0";

        // Fiat leg the deposit currency is pegged to — the common unit every
        // reward token is converted into before the 1:1 division.
        const fiatKey = fiatKeyForStablecoin(depositCurrency);
        const depositToken = getTokenAddressForStablecoin(depositCurrency);
        const depositPrice = await this.pricing.getTokenPrice({
            token: depositToken,
        });
        const depositUnitPrice = depositPrice?.[fiatKey];
        // No usable deposit-token price (unpriced peg / FX gap) — can't build
        // a 1:1-preserving factor, so fall back to no conversion (ratio 0,
        // maximal restitution) rather than a wrong non-1:1 number.
        if (!depositUnitPrice || depositUnitPrice <= 0) return "0";

        const conversionFactors = new Map<Address, number>();
        await Promise.all(
            tokens.map(async (token) => {
                const price = await this.pricing.getTokenPrice({ token });
                const unitPrice = price?.[fiatKey];
                if (!unitPrice || unitPrice <= 0) return; // → ELSE 0
                conversionFactors.set(token, unitPrice / depositUnitPrice);
            })
        );

        return this.assetLogs.sumSettledConvertedSince(
            merchantId,
            since,
            conversionFactors
        );
    }

    /**
     * Voids a document, asserting it matches the expected `kind` (the
     * deposit/withdraw void routes are separate endpoints, and neither should
     * be able to void the other's documents by guessing an id).
     *
     * Voiding a *deposit* cascades to the documents derived from it (§3.6):
     * every non-voided withdraw linking this deposit is voided too (its
     * restitution source is gone, and the ledger would otherwise still count
     * its `bankSent`), and every non-voided monthly bill whose period covers
     * or postdates the deposit has its cached PDF cleared so it regenerates
     * from current data on next access. The withdraw void routes never take
     * this path (a withdraw has no dependents).
     */
    async voidDocument(
        merchantId: string,
        id: string,
        expectedKind: "deposit" | "withdraw"
    ): Promise<BillingDocumentSelect | null> {
        const document = await this.billingDocuments.findById(merchantId, id);
        if (!document || document.kind !== expectedKind) {
            return null;
        }
        const voided = await this.billingDocuments.void(merchantId, id);
        if (voided && expectedKind === "deposit") {
            await this.cascadeDepositVoid(merchantId, voided);
        }
        return voided;
    }

    /**
     * Void the dependents of a just-voided deposit and invalidate the monthly
     * bills that folded it in. Best-effort per dependent — a failure to clear
     * one bill's cached PDF must not roll back the deposit void (the deposit
     * is already voided and the bill will simply keep a stale PDF until the
     * next successful regeneration); failures are logged.
     */
    private async cascadeDepositVoid(
        merchantId: string,
        deposit: BillingDocumentSelect
    ): Promise<void> {
        const linkedWithdraws =
            await this.billingDocuments.findWithdrawsByLinkedDeposit(
                merchantId,
                deposit.id
            );
        for (const withdraw of linkedWithdraws) {
            await this.billingDocuments.void(merchantId, withdraw.id);
        }

        await this.invalidateMonthlyBillsCovering(
            merchantId,
            deposit.documentDate
        );
    }

    /**
     * Clears the cached PDF of every non-voided monthly bill whose period
     * covers or postdates `fromDate`, so each regenerates from current data on
     * next access. Invoked whenever a deposit/withdraw enters or leaves the
     * ledger — a new (possibly back-dated) create or a void both shift the
     * derived opening/closing balances of that month's bill and every later
     * one (`findMonthlyBillsCovering` = `periodEnd > fromDate`). Best-effort
     * per bill: a storage/clear failure must not fail the triggering
     * create/void; the bill simply keeps its stale PDF until the next
     * successful regeneration.
     */
    private async invalidateMonthlyBillsCovering(
        merchantId: string,
        fromDate: Date
    ): Promise<void> {
        // Fully best-effort: this runs *after* the triggering deposit/withdraw
        // create (or void) has already committed, so nothing here — not even
        // the lookup query — may throw back to the caller. A failure would
        // otherwise turn a committed create into an HTTP 500, driving the admin
        // to retry and double-enter the document. Affected bills simply keep a
        // stale PDF until the next successful regeneration.
        let affectedBills: BillingDocumentSelect[];
        try {
            affectedBills =
                await this.billingDocuments.findMonthlyBillsCovering(
                    merchantId,
                    fromDate
                );
        } catch (err) {
            log.error(
                { err, merchantId, fromDate },
                "failed to look up covering monthly bills; bills keep stale PDFs until next regeneration"
            );
            return;
        }
        // Per-bill isolation: one bill's storage/clear failure must not skip
        // the others. `clearPdf` runs FIRST: once the row no longer points at
        // the object, a failed storage delete merely orphans a harmless blob.
        // The old order (delete then clear) could strand a dangling
        // `pdfStorageKey` pointing at a deleted object, turning the download
        // route into a 500 until a later invalidation retried.
        for (const bill of affectedBills) {
            try {
                const key = bill.pdfStorageKey;
                await this.billingDocuments.clearPdf(merchantId, bill.id);
                if (key) {
                    await this.billingStorage.delete(key);
                }
            } catch (err) {
                log.error(
                    { err, documentId: bill.id },
                    "failed to clear cached monthly-bill PDF; bill keeps stale PDF until next regeneration"
                );
            }
        }
    }

    /**
     * Corrects an existing deposit by "void + re-emit": issued documents are
     * immutable (a PDF may already be sealed, §3.6), so instead of mutating
     * in place we void the original and emit a fresh deposit (new reference,
     * new PDF) from the corrected input. Returns the new document, or null if
     * the original doesn't exist / isn't a deposit / was already voided (the
     * void step is the existence+kind gate). Not atomic with the subsequent
     * create: on the rare create failure the original stays voided and the
     * admin re-submits — an acceptable correction-in-progress state for an
     * admin-only, low-frequency flow.
     *
     * Withdraws linked to the deposit are CARRIED OVER, not destroyed: the
     * void cascade voids them (their restitution source is gone), so each
     * non-voided linked withdraw is re-created against the NEW deposit from
     * its own frozen inputs (remaining bank amount, document date, masked
     * IBAN — `maskIban` is idempotent on already-masked input — note, tx
     * hash). The restitution math intentionally recomputes against the
     * corrected deposit's amounts. Each re-create is best-effort: a failure
     * is logged and never fails the reissue itself — the admin re-enters
     * that withdraw manually. Note: correcting the deposit's CURRENCY makes
     * every carry-over fail `createWithdraw`'s currency-match guard (the
     * withdraw amounts are denominated in the old currency and cannot be
     * relabeled) — they are dropped with a log line, by design.
     */
    async reissueDeposit(
        merchantId: string,
        id: string,
        input: CreateDepositInput,
        createdBy: string | null
    ): Promise<BillingDocumentSelect | null> {
        // Snapshot BEFORE voiding — the void cascade flips these to voided.
        const linkedWithdraws =
            await this.billingDocuments.findWithdrawsByLinkedDeposit(
                merchantId,
                id
            );

        const voided = await this.voidDocument(merchantId, id, "deposit");
        if (!voided) {
            return null;
        }
        const newDeposit = await this.createDeposit(
            merchantId,
            input,
            createdBy
        );

        for (const withdraw of linkedWithdraws) {
            if (withdraw.details?.kind !== "withdraw") continue;
            try {
                await this.createWithdraw(
                    merchantId,
                    {
                        remainingBankAmount:
                            withdraw.details.remainingBankAmount,
                        currency: withdraw.currency,
                        documentDate: withdraw.documentDate,
                        linkedDepositId: newDeposit.id,
                        rawIban: withdraw.details.maskedIban,
                        note: withdraw.details.note,
                        txHash: withdraw.txHash ?? undefined,
                    },
                    createdBy
                );
            } catch (err) {
                log.error(
                    {
                        err,
                        merchantId,
                        originalWithdrawId: withdraw.id,
                        newDepositId: newDeposit.id,
                    },
                    "reissueDeposit: failed to carry a linked withdraw over to the reissued deposit; re-enter it manually"
                );
            }
        }

        return newDeposit;
    }

    /**
     * Corrects an existing withdraw by "void + re-emit" (see `reissueDeposit`).
     * The re-emit runs the full withdraw assembly, so the linked-deposit
     * guards still apply and may throw `DepositNotFoundError` /
     * `WithdrawValidationError` on bad corrected input.
     */
    async reissueWithdraw(
        merchantId: string,
        id: string,
        input: CreateWithdrawInput,
        createdBy: string | null
    ): Promise<BillingDocumentSelect | null> {
        const voided = await this.voidDocument(merchantId, id, "withdraw");
        if (!voided) {
            return null;
        }
        return this.createWithdraw(merchantId, input, createdBy);
    }

    /**
     * Re-renders and stores the PDF for a deposit/withdraw document that
     * doesn't have one yet (e.g. a prior create's render/upload step failed,
     * or a monthly-bill void cleared it — though clearing only targets
     * monthly bills). No-op (returns the document unchanged) if a PDF was
     * already issued — `setPdf` is write-once until `clearPdf` resets it
     * (§3.6). The PDF-download route calls this lazily so a document whose
     * first render failed still becomes downloadable on a later request
     * without an explicit admin action.
     */
    async regeneratePdf(
        merchantId: string,
        id: string
    ): Promise<BillingDocumentSelect | null> {
        const document = await this.billingDocuments.findById(merchantId, id);
        if (!document || document.pdfGeneratedAt) {
            return document;
        }
        await this.generateAndStorePdf(document);
        return this.billingDocuments.findById(merchantId, id);
    }

    private async generateAndStorePdf(
        document: BillingDocumentSelect
    ): Promise<void> {
        if (document.kind !== "deposit" && document.kind !== "withdraw") {
            return; // monthly_bill rendering is Phase 3.
        }
        if (document.details?.kind !== document.kind) {
            return;
        }

        const merchant = await this.merchant.findById(document.merchantId);
        const buyer = buildPdfBuyer(merchant?.accountingInfo ?? {});

        const bytes = await this.pdf.render({
            kind: document.kind,
            reference: document.reference,
            documentDate: document.documentDate,
            currency: document.currency,
            grossAmount: document.grossAmount ?? "0",
            netAmount: document.netAmount ?? "0",
            buyer,
            deposit:
                document.kind === "deposit" &&
                document.details.kind === "deposit"
                    ? {
                          vatAmount: document.details.vatAmount,
                          frakFeeAmount: document.details.frakFeeAmount,
                          giftedAmount: document.details.giftedAmount,
                          note: document.details.note,
                          paymentPlatform: document.details.paymentPlatform,
                      }
                    : undefined,
            withdraw:
                document.kind === "withdraw" &&
                document.details.kind === "withdraw"
                    ? {
                          remainingBankAmount:
                              document.details.remainingBankAmount,
                          distributedRatio: document.details.distributedRatio,
                          restitutedVat: document.details.restitutedVat,
                          restitutedFrakFee: document.details.restitutedFrakFee,
                          bankSent: document.details.bankSent,
                          maskedIban: document.details.maskedIban,
                          note: document.details.note,
                      }
                    : undefined,
        });

        const key = await this.billingStorage.upload({
            merchantId: document.merchantId,
            kind: document.kind,
            id: document.id,
            body: bytes,
        });

        await this.billingDocuments.setPdf(document.merchantId, document.id, {
            pdfStorageKey: key,
        });
    }
}
