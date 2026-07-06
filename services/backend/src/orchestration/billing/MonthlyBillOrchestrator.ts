import { log } from "@backend-infrastructure";
import {
    getTokenAddressForStablecoin,
    type Stablecoin,
} from "@frak-labs/app-essentials";
import Decimal from "decimal.js";
import type { Address } from "viem";
import type {
    BillingDocumentInsert,
    BillingDocumentSelect,
} from "../../domain/billing/db/schema";
import {
    type BillingDocumentRepository,
    isUniqueReferenceViolation,
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
import type { AssetLogRepository } from "../../domain/rewards/repositories/AssetLogRepository";
import type { BalancesRepository } from "../../domain/wallet/repositories/BalancesRepository";
import type { PricingRepository } from "../../infrastructure/pricing/PricingRepository";
import { buildPdfBuyer } from "./BillingOrchestrator";

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
        const periodEnd = new Date(
            Date.UTC(
                periodStart.getUTCFullYear(),
                periodStart.getUTCMonth() + 1,
                1
            )
        );

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

        const [
            billingCurrencies,
            depositWithdrawBefore,
            depositWithdrawInPeriod,
            rewardedBeforeRows,
            rewardedInPeriodRows,
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

        const fiatTotals = await this.buildAnnexFiatTotals(
            merchantId,
            periodStart,
            periodEnd
        );

        const review = await this.assessOnChainDivergence(
            merchantId,
            currencies,
            ledgers
        );

        const details: BillingDocumentDetails = {
            kind: "monthly_bill",
            ledgers: ledgers.map(({ currency, ledger }) => ({
                currency,
                ...ledger,
            })),
            annexRowCount: fiatTotals.rowCount,
            fiatTotals: fiatTotals.totals,
            review,
        };

        const document = await this.insertMonthlyBillDocument(
            merchantId,
            periodStart,
            periodEnd,
            currencies,
            details,
            createdBy
        );

        await this.tryGenerateAndStorePdf(document);

        return (
            (await this.billingDocuments.findById(merchantId, document.id)) ??
            document
        );
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
                documentDate: periodEnd,
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
            if (!isUniqueReferenceViolation(err)) {
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
        const rewardedBefore =
            sums.rewardedBeforeRows.find(
                (row) => row.tokenAddress === tokenAddress
            )?.total ?? "0";
        const rewardedInPeriod =
            sums.rewardedInPeriodRows.find(
                (row) => row.tokenAddress === tokenAddress
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
     */
    private async buildAnnexFiatTotals(
        merchantId: string,
        periodStart: Date,
        periodEnd: Date
    ): Promise<{
        rowCount: number;
        totals: { eur: string; usd: string; gbp: string };
    }> {
        const assetLogs = await this.assetLogs.findByMerchantAndDateRange(
            merchantId,
            periodStart,
            periodEnd
        );

        if (assetLogs.length === 0) {
            return { rowCount: 0, totals: { eur: "0", usd: "0", gbp: "0" } };
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
        const priceByToken = new Map(prices.map((p) => [p.token, p.price]));

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
            rowCount: assetLogs.length,
            totals: {
                eur: eur.toFixed(18),
                usd: usd.toFixed(18),
                gbp: gbp.toFixed(18),
            },
        };
    }

    /**
     * Compares each currency's derived closing balance against a live
     * on-chain read (best-effort — §6.2). Skips (never blocks generation) if
     * the merchant has no `bankAddress` or the on-chain read fails.
     */
    private async assessOnChainDivergence(
        merchantId: string,
        currencies: Stablecoin[],
        ledgers: Array<{
            currency: Stablecoin;
            ledger: ReturnType<
                BillingComputationService["computeMonthlyLedger"]
            >;
        }>
    ): Promise<MonthlyBillReview> {
        const checkedAt = new Date().toISOString();
        const merchant = await this.merchant.findById(merchantId);

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
                    { merchantId, perCurrency },
                    "monthly bill: derived balance diverges from on-chain balance beyond threshold"
                );
            }

            return { flagged, checkedAt, perCurrency };
        } catch (err) {
            log.error(
                { err, merchantId },
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
        document: BillingDocumentSelect
    ): Promise<void> {
        try {
            await this.generateAndStorePdf(document);
        } catch (err) {
            log.error(
                { err, documentId: document.id, kind: document.kind },
                "monthly bill PDF generation failed; document persisted without PDF"
            );
        }
    }

    private async generateAndStorePdf(
        document: BillingDocumentSelect
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

        const merchant = await this.merchant.findById(document.merchantId);
        const buyer = buildPdfBuyer(merchant?.accountingInfo ?? {});

        const annexAssetLogs = await this.assetLogs.findByMerchantAndDateRange(
            document.merchantId,
            document.periodStart,
            document.periodEnd
        );
        const uniqueTokens = [
            ...new Set(
                annexAssetLogs
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
        const priceByToken = new Map(prices.map((p) => [p.token, p.price]));

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
