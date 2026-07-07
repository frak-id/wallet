import { log } from "@backend-infrastructure";
import {
    getTokenAddressForStablecoin,
    type Stablecoin,
} from "@frak-labs/app-essentials";
import Decimal from "decimal.js";
import { type Address, isAddressEqual, zeroAddress } from "viem";
import type {
    BillingDocumentInsert,
    BillingDocumentSelect,
} from "../../domain/billing/db/schema";
import {
    type BillingDocumentRepository,
    isUniqueViolation,
} from "../../domain/billing/repositories/BillingDocumentRepository";
import type { BillingStorageRepository } from "../../domain/billing/repositories/BillingStorageRepository";
import type { BillingDocumentDetails } from "../../domain/billing/schemas";
import {
    type BillingComputationService,
    stablecoinForTokenAddress,
} from "../../domain/billing/services/BillingComputationService";
import type { BillingPdfService } from "../../domain/billing/services/BillingPdfService";
import type { MerchantRepository } from "../../domain/merchant/repositories/MerchantRepository";
import type { MerchantAccountingInfo } from "../../domain/merchant/schemas";
import type { AssetLogSelect } from "../../domain/rewards/db/schema";
import type { AssetLogRepository } from "../../domain/rewards/repositories/AssetLogRepository";
import type {
    PricingRepository,
    TokenPrice,
} from "../../infrastructure/pricing/PricingRepository";
import { buildPdfBuyer } from "./BillingOrchestrator";

/** The merchant row shape this orchestrator reads (bank address + accounting). */
type MerchantSelectForBill = Awaited<
    ReturnType<MerchantRepository["findById"]>
>;

/**
 * First instant of the month AFTER `periodStart` (UTC) — the exclusive upper
 * bound of the billed period's half-open `[periodStart, periodEnd)` window.
 */
function periodEndOf(periodStart: Date): Date {
    return new Date(
        Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth() + 1, 1)
    );
}

/** First instant (UTC) of the calendar month containing `date`. */
function monthStartOf(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/** The earlier of two dates. */
function earliest(a: Date, b: Date): Date {
    return a.getTime() <= b.getTime() ? a : b;
}

/**
 * A merchant can only be billed once its buyer identity is on file — the
 * monthly bill's "billed to" block needs the full accounting info. Every field
 * is required by the admin form, so a saved profile has them all; a partial or
 * absent one skips the merchant until it is completed.
 */
function isAccountingInfoComplete(
    info: Partial<MerchantAccountingInfo> | null | undefined
): boolean {
    return Boolean(
        info?.companyName &&
            info.vatNumber &&
            info.streetAddress &&
            info.city &&
            info.postalCode &&
            info.country &&
            info.billingEmail
    );
}

/** Runaway-date guard: max months a single merchant backfill walks. */
const MAX_BACKFILL_MONTHS = 600;

/**
 * `created_by` sentinel for cron-generated (unattended) monthly bills — no
 * human admin issued them. The column is nullable, but a stable non-null
 * sentinel keeps the audit column uniformly typed and greppable.
 */
const SYSTEM_ACTOR: Address = zeroAddress;

export class MonthlyBillAlreadyExistsError extends Error {
    constructor(
        readonly existing: BillingDocumentSelect,
        month: string
    ) {
        super(`A monthly bill for ${month} already exists for this merchant`);
    }
}

type GenerateMonthlyBillInput = {
    /** First instant of the target month, UTC (e.g. 2026-02-01T00:00:00Z). */
    periodStart: Date;
};

/**
 * Generates the monthly bill: a per-currency fiat ledger (opening/closing
 * balance derived from admin-entered deposits/withdraws + settled rewards)
 * and a reward annex (billing-feature-plan.md §6). Kept separate from
 * `BillingOrchestrator` (deposit/withdraw) — this use case pulls in pricing
 * and token-metadata collaborators that deposit/withdraw assembly never needs;
 * merging would turn `BillingOrchestrator` into an unrelated god-orchestrator
 * over two lifecycles. Both share the billing repositories/services by
 * constructor DI; neither calls the other (orchestrator → orchestrator is
 * not an allowed flow).
 *
 * Idempotency is enforced by the DB team's partial-unique
 * `(merchant_id, period_start) WHERE kind='monthly_bill'` — the document row
 * is inserted FIRST (inside `BillingDocumentRepository.create`'s
 * transaction), and only after that commits does PDF render/upload happen
 * (same non-blocking-PDF-failure pattern as deposit/withdraw). This also
 * means two concurrent generate calls can't both render — the loser's insert
 * 23505s before any rendering work starts.
 */
export class MonthlyBillOrchestrator {
    constructor(
        private readonly billingDocuments: BillingDocumentRepository,
        private readonly billingStorage: BillingStorageRepository,
        private readonly merchant: MerchantRepository,
        private readonly assetLogs: AssetLogRepository,
        private readonly computation: BillingComputationService,
        private readonly pdf: BillingPdfService,
        private readonly pricing: PricingRepository
    ) {}

    async generateMonthlyBill(
        merchantId: string,
        { periodStart }: GenerateMonthlyBillInput,
        createdBy: Address,
        { renderPdf = true }: { renderPdf?: boolean } = {}
    ): Promise<BillingDocumentSelect> {
        const periodEnd = periodEndOf(periodStart);

        const existing = await this.billingDocuments.findMonthlyBillByPeriod(
            merchantId,
            periodStart
        );
        if (existing) {
            throw new MonthlyBillAlreadyExistsError(
                existing,
                periodStart.toISOString().slice(0, 7)
            );
        }

        const computed = await this.computeBillData(
            merchantId,
            periodStart,
            periodEnd
        );

        const document = await this.insertMonthlyBillDocument(
            merchantId,
            periodStart,
            periodEnd,
            computed.currencies,
            computed.details,
            createdBy
        );

        // The cron generates bills data-only (`renderPdf: false`); the PDF
        // renders lazily on the merchant's first download (see the download
        // route + `regeneratePdf`), so an unopened bill never stores an object.
        if (renderPdf) {
            await this.tryGenerateAndStorePdf(document, {
                annexAssetLogs: computed.annexAssetLogs,
                priceByToken: computed.priceByToken,
                merchant: computed.merchant,
            });
        }

        return (
            (await this.billingDocuments.findById(merchantId, document.id)) ??
            document
        );
    }

    /**
     * Idempotent monthly-bill sweep across all merchants, run by the daily
     * cron (there is no admin trigger). For each merchant that (a) has its
     * accounting info on file and (b) has at least one deposit, generates the
     * missing monthly bills from the oldest of (merchant creation, first
     * deposit) up to — but excluding — the current month. The current month is
     * skipped because it is still accumulating deposits/rewards; it is billed
     * once it has fully elapsed. Bills are stored data-only (no PDF); the PDF
     * renders lazily on first download. Best-effort per merchant/month: one
     * failure is logged and never aborts the sweep.
     */
    async backfillAllMerchantBills(): Promise<{
        merchantsConsidered: number;
        merchantsBilled: number;
        billsCreated: number;
    }> {
        const merchants = await this.merchant.findAll();
        // `findAll` is hard-capped (currently 500 rows). Once merchant count
        // reaches it, the tail is silently unbilled — surface it loudly until
        // the repository grows cursor pagination.
        if (merchants.length >= 500) {
            log.warn(
                { merchantCount: merchants.length },
                "monthly-bill backfill: merchant list hit the findAll cap; some merchants may be skipped — add pagination"
            );
        }
        const currentMonthStart = monthStartOf(new Date());

        let merchantsBilled = 0;
        let billsCreated = 0;
        for (const merchant of merchants) {
            try {
                const created = await this.backfillMerchant(
                    merchant,
                    currentMonthStart
                );
                if (created > 0) merchantsBilled++;
                billsCreated += created;
            } catch (err) {
                log.error(
                    { err, merchantId: merchant.id },
                    "monthly-bill backfill failed for merchant; skipping"
                );
            }
        }

        return {
            merchantsConsidered: merchants.length,
            merchantsBilled,
            billsCreated,
        };
    }

    /**
     * Generates the missing monthly bills for one merchant, returning how many
     * were created (0 if skipped or already up to date). Skips merchants
     * without complete accounting info or without any deposit — nothing to
     * bill. Existing periods are loaded once and skipped so re-running the
     * sweep is cheap.
     */
    private async backfillMerchant(
        merchant: NonNullable<MerchantSelectForBill>,
        currentMonthStart: Date
    ): Promise<number> {
        if (!isAccountingInfoComplete(merchant.accountingInfo)) {
            return 0;
        }

        const oldestDeposit =
            await this.billingDocuments.findOldestDepositDate(merchant.id);
        if (!oldestDeposit) return 0;

        const rangeStart = monthStartOf(
            merchant.createdAt
                ? earliest(merchant.createdAt, oldestDeposit)
                : oldestDeposit
        );

        const existing = new Set(
            (
                await this.billingDocuments.listMonthlyBillPeriodStarts(
                    merchant.id
                )
            ).map((d) => d.getTime())
        );

        let created = 0;
        let periodStart = rangeStart;
        for (
            let i = 0;
            i < MAX_BACKFILL_MONTHS &&
            periodStart.getTime() < currentMonthStart.getTime();
            i++
        ) {
            // A period's end is the next month's start.
            const periodEnd = periodEndOf(periodStart);
            if (!existing.has(periodStart.getTime())) {
                created += await this.backfillMonth(merchant.id, periodStart);
            }
            periodStart = periodEnd;
        }
        return created;
    }

    /**
     * Generates a single month's data-only bill, returning 1 on success and 0
     * when the period already exists (idempotency race) or the render-less
     * generation fails — both are non-fatal to the surrounding sweep.
     */
    private async backfillMonth(
        merchantId: string,
        periodStart: Date
    ): Promise<number> {
        try {
            await this.generateMonthlyBill(
                merchantId,
                { periodStart },
                SYSTEM_ACTOR,
                { renderPdf: false }
            );
            return 1;
        } catch (err) {
            if (!(err instanceof MonthlyBillAlreadyExistsError)) {
                log.error(
                    { err, merchantId, periodStart },
                    "monthly-bill backfill: failed to generate a month"
                );
            }
            return 0;
        }
    }

    /**
     * Re-renders and stores the PDF for a monthly bill that doesn't have one
     * yet (its first render/upload failed, or a voided deposit cleared the
     * cached PDF). Recomputes the details (ledgers/annex/review) from CURRENT
     * data for the stored period — a cleared bill's numbers may have moved
     * since the failed render — updates the row's frozen `details`, then
     * re-renders. No-op (returns the document unchanged) for a bill that
     * already has a PDF (write-once) or a non-monthly/voided/period-less row.
     * PDF-render failure stays non-blocking (logged); the bill keeps
     * `pdfGeneratedAt IS NULL` and can be regenerated again on the next call.
     */
    async regeneratePdf(
        merchantId: string,
        id: string
    ): Promise<BillingDocumentSelect | null> {
        const document = await this.billingDocuments.findById(merchantId, id);
        if (
            !document ||
            document.kind !== "monthly_bill" ||
            document.pdfGeneratedAt ||
            !document.periodStart ||
            !document.periodEnd
        ) {
            return document;
        }

        const computed = await this.computeBillData(
            merchantId,
            document.periodStart,
            document.periodEnd
        );

        const refreshed = await this.billingDocuments.updateMonthlyBillDetails(
            merchantId,
            id,
            computed.details
        );
        if (!refreshed) return document;

        await this.tryGenerateAndStorePdf(refreshed, {
            annexAssetLogs: computed.annexAssetLogs,
            priceByToken: computed.priceByToken,
            merchant: computed.merchant,
        });

        return this.billingDocuments.findById(merchantId, id);
    }

    /**
     * Shared assembly for `generateMonthlyBill` and `regeneratePdf`: pulls the
     * grouped sums for the period once, folds them into per-currency ledgers,
     * builds the reward annex (with its priced fiat totals), and returns the
     * frozen `details` plus the annex rows, the price map (threaded into PDF
     * rendering so annex fiat rows agree with `fiatTotals`, §6.3), and the
     * merchant (fetched once for the PDF buyer block).
     */
    private async computeBillData(
        merchantId: string,
        periodStart: Date,
        periodEnd: Date
    ): Promise<{
        currencies: Stablecoin[];
        details: BillingDocumentDetails;
        annexAssetLogs: AssetLogSelect[];
        priceByToken: Map<Address, TokenPrice | undefined>;
        merchant: MerchantSelectForBill | null;
    }> {
        const [
            billingCurrencies,
            depositWithdrawBefore,
            depositWithdrawInPeriod,
            rewardedBeforeRows,
            rewardedInPeriodRows,
            merchant,
        ] = await Promise.all([
            this.billingDocuments.distinctCurrencies(merchantId),
            this.billingDocuments.aggregateDepositWithdrawByCurrency(
                merchantId,
                { before: periodStart }
            ),
            this.billingDocuments.aggregateDepositWithdrawByCurrency(
                merchantId,
                { start: periodStart, end: periodEnd }
            ),
            this.assetLogs.sumSettledByToken(merchantId, {
                before: periodStart,
            }),
            this.assetLogs.sumSettledByToken(merchantId, {
                start: periodStart,
                end: periodEnd,
            }),
            this.merchant.findById(merchantId),
        ]);

        const currencies = this.resolveLedgerCurrencies(
            billingCurrencies,
            rewardedBeforeRows,
            rewardedInPeriodRows
        );

        const ledgers = currencies.map((currency) =>
            this.buildCurrencyLedger(currency, {
                depositWithdrawBefore,
                depositWithdrawInPeriod,
                rewardedBeforeRows,
                rewardedInPeriodRows,
            })
        );

        const annexData = await this.buildAnnexData(
            merchantId,
            periodStart,
            periodEnd
        );

        const details: BillingDocumentDetails = {
            kind: "monthly_bill",
            ledgers: ledgers.map(({ currency, ledger }) => ({
                currency,
                ...ledger,
            })),
            annexRowCount: annexData.rowCount,
            fiatTotals: annexData.totals,
        };

        return {
            currencies,
            details,
            annexAssetLogs: annexData.assetLogs,
            priceByToken: annexData.priceByToken,
            merchant,
        };
    }

    /**
     * Inserts the monthly-bill row, guarded by the pre-check above AND the
     * DB team's partial-unique `(merchant_id, period_start) WHERE
     * kind='monthly_bill'` (the real race guarantee — the pre-check alone
     * has a TOCTOU gap between two concurrent calls for the same period).
     * `BillingDocumentRepository.create`'s own retry-on-23505 targets the
     * *reference* uniqueness, not the period uniqueness, so a genuine period
     * race still surfaces as a raw 23505 out of `create` after its retries
     * are exhausted — caught here and re-resolved to the same
     * `MonthlyBillAlreadyExistsError` the pre-check throws, so callers only
     * ever see one error shape for "this period already has a bill".
     */
    private async insertMonthlyBillDocument(
        merchantId: string,
        periodStart: Date,
        periodEnd: Date,
        currencies: Stablecoin[],
        details: BillingDocumentDetails,
        createdBy: Address
    ): Promise<BillingDocumentSelect> {
        try {
            return await this.billingDocuments.create({
                merchantId,
                kind: "monthly_bill",
                // Last instant of the billed period, not `periodEnd` (the
                // first instant of the *next* month): `create` buckets the
                // reference counter by `documentDate.getUTCFullYear()`, so a
                // `periodEnd`-dated December bill would take a next-year
                // reference (`BILL-2027-…`) and sort into the wrong year in
                // date-range filters (§3.2/§6.4).
                documentDate: new Date(periodEnd.getTime() - 1),
                periodStart,
                periodEnd,
                // No single currency/gross/net for a multi-currency monthly
                // bill — the CHECK constraint only requires amounts for
                // deposit/withdraw.
                currency: currencies[0] ?? "eure",
                details,
                createdBy,
            } satisfies Omit<BillingDocumentInsert, "reference">);
        } catch (err) {
            if (!isUniqueViolation(err)) {
                throw err;
            }
            const existing =
                await this.billingDocuments.findMonthlyBillByPeriod(
                    merchantId,
                    periodStart
                );
            if (existing) {
                throw new MonthlyBillAlreadyExistsError(
                    existing,
                    periodStart.toISOString().slice(0, 7)
                );
            }
            // Unique violation but no period match found (e.g. the reference
            // counter itself collided, or a voided monthly bill occupies the
            // slot) — not the idempotency case; surface the original error.
            throw err;
        }
    }

    /**
     * Ledger currency set = distinct non-voided deposit/withdraw currencies
     * ∪ stablecoin currencies seen in settled rewards up to `periodEnd`
     * (before-period and in-period reward rows both count — a currency with
     * rewards only in-period still needs a ledger row). Rewards store a
     * token address, not a currency — mapped back via
     * `stablecoinForTokenAddress`; non-stablecoin tokens are excluded from
     * the ledger set entirely, §6.2/§C4). Pure fold over already-fetched
     * rows — no I/O here (the grouped queries are fetched once in
     * `generateMonthlyBill` and reused for every currency's ledger, avoiding
     * an N+1 query pattern).
     */
    private resolveLedgerCurrencies(
        billingCurrencies: Stablecoin[],
        rewardedBeforeRows: Array<{ tokenAddress: Address; total: string }>,
        rewardedInPeriodRows: Array<{ tokenAddress: Address; total: string }>
    ): Stablecoin[] {
        const rewardCurrencies = [
            ...rewardedBeforeRows,
            ...rewardedInPeriodRows,
        ]
            .map(({ tokenAddress }) => stablecoinForTokenAddress(tokenAddress))
            .filter(
                (currency): currency is Stablecoin => currency !== undefined
            );

        return [...new Set([...billingCurrencies, ...rewardCurrencies])];
    }

    private buildCurrencyLedger(
        currency: Stablecoin,
        sums: {
            depositWithdrawBefore: Array<{
                currency: Stablecoin;
                deposited: string;
                withdrawn: string;
            }>;
            depositWithdrawInPeriod: Array<{
                currency: Stablecoin;
                deposited: string;
                withdrawn: string;
            }>;
            rewardedBeforeRows: Array<{ tokenAddress: Address; total: string }>;
            rewardedInPeriodRows: Array<{
                tokenAddress: Address;
                total: string;
            }>;
        }
    ): {
        currency: Stablecoin;
        ledger: ReturnType<BillingComputationService["computeMonthlyLedger"]>;
    } {
        const tokenAddress = getTokenAddressForStablecoin(currency);

        const beforeRow = sums.depositWithdrawBefore.find(
            (row) => row.currency === currency
        );
        const inPeriodRow = sums.depositWithdrawInPeriod.find(
            (row) => row.currency === currency
        );
        // Address comparison via `isAddressEqual` (checksum-safe), never
        // `===`: DB-sourced `row.tokenAddress` comes back lowercase
        // (customHex.fromDriver -> viem's bytesToHex), while `tokenAddress`
        // here is the EIP-55 checksummed constant -- a raw `===` always
        // fails and silently zeroes every reward deduction.
        const rewardedBefore =
            sums.rewardedBeforeRows.find((row) =>
                isAddressEqual(row.tokenAddress, tokenAddress)
            )?.total ?? "0";
        const rewardedInPeriod =
            sums.rewardedInPeriodRows.find((row) =>
                isAddressEqual(row.tokenAddress, tokenAddress)
            )?.total ?? "0";

        const ledger = this.computation.computeMonthlyLedger({
            depositedBefore: beforeRow?.deposited ?? "0",
            withdrawnBefore: beforeRow?.withdrawn ?? "0",
            rewardedBefore,
            depositedInPeriod: inPeriodRow?.deposited ?? "0",
            withdrawnInPeriod: inPeriodRow?.withdrawn ?? "0",
            rewardedInPeriod,
        });

        return { currency, ledger };
    }

    /**
     * Reward annex enrichment: fiat conversion happens in the pure
     * `computation.annexRowFiat` (decimal.js), never `RewardHistoryService`
     * (which uses `parseFloat` + float accumulation — unacceptable for a
     * frozen legal total, §B3). The only float input anywhere in this path
     * is the spot `TokenPrice` (disclosed limitation, §6.3).
     *
     * Fetches the settled-reward rows for the period exactly once and returns
     * both the rows and the `priceByToken` map used to compute `totals`. The
     * per-row PDF annex rows are derived from the same `assetLogs` array AND
     * the same price map (threaded through `computeBillData` into
     * `generateAndStorePdf`) instead of re-querying/re-pricing — avoids a
     * duplicate DB round-trip and, critically, the price-cache-expiry window
     * where a second price fetch could make the PDF's per-row fiat values
     * disagree with the frozen `fiatTotals` (§6.3).
     */
    private async buildAnnexData(
        merchantId: string,
        periodStart: Date,
        periodEnd: Date
    ): Promise<{
        assetLogs: AssetLogSelect[];
        rowCount: number;
        totals: { eur: string; usd: string; gbp: string };
        priceByToken: Map<Address, TokenPrice | undefined>;
    }> {
        const assetLogs = await this.assetLogs.findByMerchantAndDateRange(
            merchantId,
            periodStart,
            periodEnd
        );

        if (assetLogs.length === 0) {
            return {
                assetLogs,
                rowCount: 0,
                totals: { eur: "0", usd: "0", gbp: "0" },
                priceByToken: new Map(),
            };
        }

        const uniqueTokens = [
            ...new Set(
                assetLogs
                    .map((log) => log.tokenAddress)
                    .filter((addr): addr is Address => addr !== null)
            ),
        ];

        const prices = await Promise.all(
            uniqueTokens.map(async (token) => ({
                token,
                price: await this.pricing.getTokenPrice({ token }),
            }))
        );
        const priceByToken = new Map<Address, TokenPrice | undefined>(
            prices.map((p) => [p.token, p.price])
        );

        let eur = new Decimal(0);
        let usd = new Decimal(0);
        let gbp = new Decimal(0);

        for (const log of assetLogs) {
            if (!log.tokenAddress) continue;
            const price = priceByToken.get(log.tokenAddress);
            if (!price) continue;
            const fiat = this.computation.annexRowFiat({
                amount: log.amount,
                price,
            });
            eur = eur.plus(fiat.eur);
            usd = usd.plus(fiat.usd);
            gbp = gbp.plus(fiat.gbp);
        }

        return {
            assetLogs,
            rowCount: assetLogs.length,
            totals: {
                eur: eur.toFixed(18),
                usd: usd.toFixed(18),
                gbp: gbp.toFixed(18),
            },
            priceByToken,
        };
    }

    private async tryGenerateAndStorePdf(
        document: BillingDocumentSelect,
        pdfData: {
            annexAssetLogs: AssetLogSelect[];
            priceByToken: Map<Address, TokenPrice | undefined>;
            merchant: MerchantSelectForBill | null;
        }
    ): Promise<void> {
        try {
            await this.generateAndStorePdf(document, pdfData);
        } catch (err) {
            log.error(
                { err, documentId: document.id, kind: document.kind },
                "monthly bill PDF generation failed; document persisted without PDF"
            );
        }
    }

    /**
     * Renders and stores the monthly-bill PDF from the pre-computed `pdfData`
     * (annex rows, the SAME price map that produced `details.fiatTotals`, and
     * the already-loaded merchant) — no re-query, no re-price, so the PDF's
     * per-row fiat values always reconcile with the frozen totals (§6.3).
     */
    private async generateAndStorePdf(
        document: BillingDocumentSelect,
        pdfData: {
            annexAssetLogs: AssetLogSelect[];
            priceByToken: Map<Address, TokenPrice | undefined>;
            merchant: MerchantSelectForBill | null;
        }
    ): Promise<void> {
        if (
            document.kind !== "monthly_bill" ||
            document.details?.kind !== "monthly_bill" ||
            !document.periodStart ||
            !document.periodEnd
        ) {
            return;
        }
        const details = document.details;
        const { annexAssetLogs, priceByToken, merchant } = pdfData;

        const buyer = buildPdfBuyer(merchant?.accountingInfo ?? {});

        const annexRows = annexAssetLogs
            .filter((log) => log.tokenAddress && log.settledAt)
            .map((log) => {
                const price = log.tokenAddress
                    ? priceByToken.get(log.tokenAddress)
                    : undefined;
                const currency = log.tokenAddress
                    ? (stablecoinForTokenAddress(log.tokenAddress) ?? "")
                    : "";
                const fiat = price
                    ? this.computation.annexRowFiat({
                          amount: log.amount,
                          price,
                      })
                    : { eur: "0", usd: "0", gbp: "0" };
                return {
                    // biome-ignore lint/style/noNonNullAssertion: filtered above
                    settledAt: log.settledAt!,
                    amount: log.amount,
                    currency,
                    // EUR as the annex's display reporting currency — there's
                    // no per-merchant reporting-currency preference in the
                    // schema (v1). `details.fiatTotals` carries eur/usd/gbp
                    // together; the annex shows one for readability.
                    fiatValue: fiat.eur,
                    txHash: log.onchainTxHash ?? undefined,
                };
            });

        const bytes = await this.pdf.render({
            kind: "monthly_bill",
            reference: document.reference,
            documentDate: document.documentDate,
            currency: document.currency,
            grossAmount: "0",
            netAmount: "0",
            buyer,
            monthlyBill: {
                periodStart: document.periodStart,
                periodEnd: document.periodEnd,
                ledgers: details.ledgers,
                fiatTotals: details.fiatTotals,
                annexRows,
            },
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
