import { log } from "@backend-infrastructure";
import {
    getTokenAddressForStablecoin,
    type Stablecoin,
} from "@frak-labs/app-essentials";
import Decimal from "decimal.js";
import { type Address, isAddressEqual } from "viem";
import type {
    BillingDocumentInsert,
    BillingDocumentSelect,
} from "../../domain/billing/db/schema";
import {
    type BillingDocumentRepository,
    isUniqueViolation,
} from "../../domain/billing/repositories/BillingDocumentRepository";
import type { BillingStorageRepository } from "../../domain/billing/repositories/BillingStorageRepository";
import type {
    BillingDocumentDetails,
    MonthlyBillReview,
} from "../../domain/billing/schemas";
import {
    type BillingComputationService,
    stablecoinForTokenAddress,
} from "../../domain/billing/services/BillingComputationService";
import type { BillingPdfService } from "../../domain/billing/services/BillingPdfService";
import type { CampaignBankRepository } from "../../domain/campaign-bank/repositories/CampaignBankRepository";
import type { MerchantRepository } from "../../domain/merchant/repositories/MerchantRepository";
import type { AssetLogSelect } from "../../domain/rewards/db/schema";
import type { AssetLogRepository } from "../../domain/rewards/repositories/AssetLogRepository";
import type { BalancesRepository } from "../../domain/wallet/repositories/BalancesRepository";
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
 * balance derived from admin-entered deposits/withdraws + settled rewards),
 * a reward annex, and a live on-chain divergence check
 * (billing-feature-plan.md §6). Kept separate from `BillingOrchestrator`
 * (deposit/withdraw) — this use case pulls in campaign-bank, pricing, and
 * token-metadata collaborators that deposit/withdraw assembly never needs;
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
        private readonly campaignBank: CampaignBankRepository,
        private readonly computation: BillingComputationService,
        private readonly pdf: BillingPdfService,
        private readonly pricing: PricingRepository,
        private readonly balances: BalancesRepository
    ) {}

    async generateMonthlyBill(
        merchantId: string,
        { periodStart }: GenerateMonthlyBillInput,
        createdBy: Address
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

        await this.tryGenerateAndStorePdf(document, {
            annexAssetLogs: computed.annexAssetLogs,
            priceByToken: computed.priceByToken,
            merchant: computed.merchant,
        });

        return (
            (await this.billingDocuments.findById(merchantId, document.id)) ??
            document
        );
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
     * builds the reward annex (with its priced fiat totals), runs the on-chain
     * divergence check, and returns the frozen `details` plus the annex rows,
     * the price map (threaded into PDF rendering so annex fiat rows agree with
     * `fiatTotals`, §6.3), and the merchant (fetched once, reused for the
     * divergence check and the PDF buyer block).
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

        const review = await this.assessOnChainDivergence(
            merchant,
            currencies,
            ledgers
        );

        const details: BillingDocumentDetails = {
            kind: "monthly_bill",
            ledgers: ledgers.map(({ currency, ledger }) => ({
                currency,
                ...ledger,
            })),
            annexRowCount: annexData.rowCount,
            fiatTotals: annexData.totals,
            review,
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

    /**
     * Compares each currency's derived closing balance against a live
     * on-chain read (best-effort — §6.2). Skips (never blocks generation) if
     * the merchant has no `bankAddress` or the on-chain read fails. Takes the
     * already-fetched `merchant` (loaded once in `computeBillData`) rather
     * than re-reading it.
     */
    private async assessOnChainDivergence(
        merchant: MerchantSelectForBill | null,
        currencies: Stablecoin[],
        ledgers: Array<{
            currency: Stablecoin;
            ledger: ReturnType<
                BillingComputationService["computeMonthlyLedger"]
            >;
        }>
    ): Promise<MonthlyBillReview> {
        const checkedAt = new Date().toISOString();

        if (!merchant?.bankAddress) {
            return {
                flagged: false,
                checkedAt,
                perCurrency: [],
                skipped: true,
                skipReason: "merchant has no bank address",
            };
        }

        try {
            const tokenAddresses = currencies.map(getTokenAddressForStablecoin);
            const [{ balances }, tokenMetadata] = await Promise.all([
                this.campaignBank.getBankOnChainState(
                    merchant.bankAddress,
                    tokenAddresses
                ),
                this.balances.getTokenMetadataBatch(tokenAddresses),
            ]);

            const perCurrency = currencies.map((currency) => {
                const tokenAddress = getTokenAddressForStablecoin(currency);
                const decimals =
                    tokenMetadata.get(tokenAddress)?.decimals ?? 18;
                const rawBalance = balances.get(tokenAddress) ?? 0n;
                // Scale the raw on-chain bigint to the same human-decimal
                // unit as the derived balance — comparing bigint-to-human
                // directly would "diverge" by ~10^decimals every time.
                const onChainBalance = new Decimal(rawBalance.toString())
                    .div(new Decimal(10).pow(decimals))
                    .toFixed(18);
                const derivedClosing =
                    ledgers.find((l) => l.currency === currency)?.ledger
                        .closingBalance ?? "0";
                const { deltaAbs, withinThreshold } =
                    this.computation.assessDivergence(
                        derivedClosing,
                        onChainBalance
                    );

                return {
                    currency,
                    derivedClosing,
                    onChainBalance,
                    deltaAbs,
                    withinThreshold,
                };
            });

            const flagged = perCurrency.some((c) => !c.withinThreshold);
            if (flagged) {
                log.warn(
                    { merchantId: merchant.id, perCurrency },
                    "monthly bill: derived balance diverges from on-chain balance beyond threshold"
                );
            }

            return { flagged, checkedAt, perCurrency };
        } catch (err) {
            log.error(
                { err, merchantId: merchant.id },
                "monthly bill: on-chain divergence check failed; publishing without it"
            );
            return {
                flagged: false,
                checkedAt,
                perCurrency: [],
                skipped: true,
                skipReason: "on-chain read failed",
            };
        }
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
                review: details.review
                    ? {
                          flagged: details.review.flagged,
                          skipped: details.review.skipped,
                          skipReason: details.review.skipReason,
                      }
                    : undefined,
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
