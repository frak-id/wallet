import { currentStablecoins } from "@frak-labs/app-essentials";
import { describe, expect, it, vi } from "vitest";
import type { BillingDocumentSelect } from "../../domain/billing/db/schema";
import type { BillingDocumentRepository } from "../../domain/billing/repositories/BillingDocumentRepository";
import type { BillingStorageRepository } from "../../domain/billing/repositories/BillingStorageRepository";
import { BillingComputationService } from "../../domain/billing/services/BillingComputationService";
import type { BillingPdfService } from "../../domain/billing/services/pdf";
import type { MerchantRepository } from "../../domain/merchant/repositories/MerchantRepository";
import type { AssetLogRepository } from "../../domain/rewards/repositories/AssetLogRepository";
import type { PricingRepository } from "../../infrastructure/pricing/PricingRepository";
import {
    MonthlyBillAlreadyExistsError,
    MonthlyBillOrchestrator,
} from "./MonthlyBillOrchestrator";

function makeMonthlyBillDoc(
    overrides: Partial<BillingDocumentSelect> = {}
): BillingDocumentSelect {
    return {
        id: "bill-1",
        merchantId: "merchant-1",
        kind: "monthly_bill",
        reference: "BILL-2026-0001",
        documentDate: new Date("2026-03-01T00:00:00.000Z"),
        periodStart: new Date("2026-02-01T00:00:00.000Z"),
        periodEnd: new Date("2026-03-01T00:00:00.000Z"),
        currency: "eure",
        grossAmount: null,
        netAmount: null,
        txHash: null,
        linkedDepositId: null,
        details: {
            kind: "monthly_bill",
            ledgers: [],
            annexRowCount: 0,
            fiatTotals: { eur: "0", usd: "0", gbp: "0" },
        },
        pdfStorageKey: null,
        pdfGeneratedAt: null,
        createdBy: "0x0000000000000000000000000000000000000001",
        voidedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    } as BillingDocumentSelect;
}

function makeOrchestrator(
    overrides: Partial<{
        billingDocuments: Partial<BillingDocumentRepository>;
        billingStorage: Partial<BillingStorageRepository>;
        merchant: Partial<MerchantRepository>;
        assetLogs: Partial<AssetLogRepository>;
        pricing: Partial<PricingRepository>;
        pdf: Partial<BillingPdfService>;
    }> = {}
) {
    const billingDocuments = {
        findMonthlyBillByPeriod: vi.fn().mockResolvedValue(null),
        distinctCurrencies: vi.fn().mockResolvedValue([]),
        aggregateDepositWithdrawByCurrency: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
        findById: vi.fn(),
        setPdf: vi.fn(),
        updateMonthlyBillDetails: vi.fn(),
        ...overrides.billingDocuments,
    } as unknown as BillingDocumentRepository;

    const billingStorage = {
        upload: vi.fn().mockResolvedValue("merchant-1/monthly_bill/bill-1.pdf"),
        ...overrides.billingStorage,
    } as unknown as BillingStorageRepository;

    const merchant = {
        findById: vi.fn().mockResolvedValue(null),
        ...overrides.merchant,
    } as unknown as MerchantRepository;

    const assetLogs = {
        sumSettledByToken: vi.fn().mockResolvedValue([]),
        findByMerchantAndDateRange: vi.fn().mockResolvedValue([]),
        countSettledByMerchantAndDateRange: vi.fn().mockResolvedValue(0),
        ...overrides.assetLogs,
    } as unknown as AssetLogRepository;

    const computation = new BillingComputationService();

    const pdf = {
        render: vi.fn().mockResolvedValue(new Uint8Array([37, 80, 68, 70])),
        ...overrides.pdf,
    } as unknown as BillingPdfService;

    const pricing = {
        getTokenPrice: vi.fn().mockResolvedValue({ eur: 1, usd: 1, gbp: 1 }),
        ...overrides.pricing,
    } as unknown as PricingRepository;

    return new MonthlyBillOrchestrator(
        billingDocuments,
        billingStorage,
        merchant,
        assetLogs,
        computation,
        pdf,
        pricing
    );
}

describe("MonthlyBillOrchestrator", () => {
    describe("idempotency", () => {
        it("throws MonthlyBillAlreadyExistsError when a bill for the period already exists", async () => {
            const existing = makeMonthlyBillDoc();
            const findMonthlyBillByPeriod = vi.fn().mockResolvedValue(existing);
            const create = vi.fn();
            const orchestrator = makeOrchestrator({
                billingDocuments: { findMonthlyBillByPeriod, create },
            });

            await expect(
                orchestrator.generateMonthlyBill(
                    "merchant-1",
                    { periodStart: new Date("2026-02-01T00:00:00.000Z") },
                    "0x0000000000000000000000000000000000000002"
                )
            ).rejects.toBeInstanceOf(MonthlyBillAlreadyExistsError);
            expect(create).not.toHaveBeenCalled();
        });

        it("resolves a true insert-time race (period unique violation) to the same error shape", async () => {
            // Pre-check passes (no existing doc yet), but `create` hits the
            // DB-level partial-unique constraint because a concurrent call
            // won the race and inserted first.
            const raceWinner = makeMonthlyBillDoc({ id: "race-winner" });
            const create = vi.fn().mockRejectedValue(
                Object.assign(new Error("conflict"), {
                    code: "23505",
                })
            );
            const findMonthlyBillByPeriod = vi
                .fn()
                .mockResolvedValueOnce(null) // pre-check: no existing doc
                .mockResolvedValueOnce(raceWinner); // post-collision lookup

            const orchestrator = makeOrchestrator({
                billingDocuments: { findMonthlyBillByPeriod, create },
            });

            await expect(
                orchestrator.generateMonthlyBill(
                    "merchant-1",
                    { periodStart: new Date("2026-02-01T00:00:00.000Z") },
                    "0x0000000000000000000000000000000000000002"
                )
            ).rejects.toBeInstanceOf(MonthlyBillAlreadyExistsError);
        });

        it("re-throws a unique violation that isn't a period collision", async () => {
            const create = vi.fn().mockRejectedValue(
                Object.assign(new Error("conflict"), {
                    code: "23505",
                })
            );
            const findMonthlyBillByPeriod = vi
                .fn()
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(null); // no period match on re-check

            const orchestrator = makeOrchestrator({
                billingDocuments: { findMonthlyBillByPeriod, create },
            });

            await expect(
                orchestrator.generateMonthlyBill(
                    "merchant-1",
                    { periodStart: new Date("2026-02-01T00:00:00.000Z") },
                    "0x0000000000000000000000000000000000000002"
                )
            ).rejects.not.toBeInstanceOf(MonthlyBillAlreadyExistsError);
        });

        it("carries the existing document on the thrown error (for a 409 response)", async () => {
            const existing = makeMonthlyBillDoc({ id: "existing-bill" });
            const orchestrator = makeOrchestrator({
                billingDocuments: {
                    findMonthlyBillByPeriod: vi
                        .fn()
                        .mockResolvedValue(existing),
                },
            });

            try {
                await orchestrator.generateMonthlyBill(
                    "merchant-1",
                    { periodStart: new Date("2026-02-01T00:00:00.000Z") },
                    "0x0000000000000000000000000000000000000002"
                );
                expect.unreachable();
            } catch (err) {
                expect(err).toBeInstanceOf(MonthlyBillAlreadyExistsError);
                expect((err as MonthlyBillAlreadyExistsError).existing.id).toBe(
                    "existing-bill"
                );
            }
        });
    });

    describe("generateMonthlyBill assembly", () => {
        it("builds a ledger per resolved currency and persists the document", async () => {
            const created = makeMonthlyBillDoc();
            const create = vi.fn().mockResolvedValue(created);
            const findById = vi.fn().mockResolvedValue(created);
            const distinctCurrencies = vi.fn().mockResolvedValue(["eure"]);
            const aggregateDepositWithdrawByCurrency = vi
                .fn()
                .mockResolvedValue([
                    { currency: "eure", deposited: "1000", withdrawn: "0" },
                ]);

            const orchestrator = makeOrchestrator({
                billingDocuments: {
                    findMonthlyBillByPeriod: vi.fn().mockResolvedValue(null),
                    distinctCurrencies,
                    aggregateDepositWithdrawByCurrency,
                    create,
                    findById,
                },
            });

            const result = await orchestrator.generateMonthlyBill(
                "merchant-1",
                { periodStart: new Date("2026-02-01T00:00:00.000Z") },
                "0x0000000000000000000000000000000000000002"
            );

            expect(create).toHaveBeenCalledTimes(1);
            const createArg = create.mock.calls[0][0];
            expect(createArg.kind).toBe("monthly_bill");
            expect(createArg.periodStart).toEqual(
                new Date("2026-02-01T00:00:00.000Z")
            );
            expect(createArg.periodEnd).toEqual(
                new Date("2026-03-01T00:00:00.000Z")
            );
            expect(createArg.details.ledgers).toHaveLength(1);
            expect(createArg.details.ledgers[0].currency).toBe("eure");
            expect(result.id).toBe(created.id);
        });

        it("resolves the currency set as the union of billing-doc currencies and reward-token currencies", async () => {
            const create = vi.fn().mockResolvedValue(makeMonthlyBillDoc());
            const distinctCurrencies = vi.fn().mockResolvedValue(["eure"]);
            const sumSettledByToken = vi
                .fn()
                .mockResolvedValue([
                    { tokenAddress: currentStablecoins.usdc, total: "50" },
                ]);

            const orchestrator = makeOrchestrator({
                billingDocuments: {
                    findMonthlyBillByPeriod: vi.fn().mockResolvedValue(null),
                    distinctCurrencies,
                    create,
                },
                assetLogs: { sumSettledByToken },
            });

            await orchestrator.generateMonthlyBill(
                "merchant-1",
                { periodStart: new Date("2026-02-01T00:00:00.000Z") },
                "0x0000000000000000000000000000000000000002"
            );

            const createArg = create.mock.calls[0][0];
            const currencies = createArg.details.ledgers.map(
                (l: { currency: string }) => l.currency
            );
            expect(currencies.sort()).toEqual(["eure", "usdc"]);
        });

        it("excludes non-stablecoin reward tokens from the ledger currency set", async () => {
            const create = vi.fn().mockResolvedValue(makeMonthlyBillDoc());
            const sumSettledByToken = vi.fn().mockResolvedValue([
                {
                    tokenAddress: "0x0000000000000000000000000000000000000099",
                    total: "50",
                },
            ]);

            const orchestrator = makeOrchestrator({
                billingDocuments: {
                    findMonthlyBillByPeriod: vi.fn().mockResolvedValue(null),
                    distinctCurrencies: vi.fn().mockResolvedValue([]),
                    create,
                },
                assetLogs: { sumSettledByToken },
            });

            await orchestrator.generateMonthlyBill(
                "merchant-1",
                { periodStart: new Date("2026-02-01T00:00:00.000Z") },
                "0x0000000000000000000000000000000000000002"
            );

            const createArg = create.mock.calls[0][0];
            expect(createArg.details.ledgers).toHaveLength(0);
        });
    });

    describe("per-row annex fetch gating (B1 perf)", () => {
        it("does NOT fetch per-row annex data on the data-only cron path (renderPdf: false)", async () => {
            const create = vi.fn().mockResolvedValue(makeMonthlyBillDoc());
            const findByMerchantAndDateRange = vi.fn().mockResolvedValue([]);
            const sumSettledByToken = vi
                .fn()
                .mockResolvedValue([
                    { tokenAddress: currentStablecoins.eure, total: "10" },
                ]);

            const orchestrator = makeOrchestrator({
                billingDocuments: {
                    findMonthlyBillByPeriod: vi.fn().mockResolvedValue(null),
                    distinctCurrencies: vi.fn().mockResolvedValue(["eure"]),
                    create,
                },
                assetLogs: { findByMerchantAndDateRange, sumSettledByToken },
            });

            await orchestrator.generateMonthlyBill(
                "merchant-1",
                { periodStart: new Date("2026-02-01T00:00:00.000Z") },
                "0x0000000000000000000000000000000000000002",
                { renderPdf: false }
            );

            expect(findByMerchantAndDateRange).not.toHaveBeenCalled();
        });

        it("DOES fetch per-row annex data when a PDF is rendered (renderPdf: true, default)", async () => {
            const created = makeMonthlyBillDoc();
            const create = vi.fn().mockResolvedValue(created);
            const findById = vi.fn().mockResolvedValue(created);
            const findByMerchantAndDateRange = vi.fn().mockResolvedValue([]);
            const sumSettledByToken = vi
                .fn()
                .mockResolvedValue([
                    { tokenAddress: currentStablecoins.eure, total: "10" },
                ]);

            const orchestrator = makeOrchestrator({
                billingDocuments: {
                    findMonthlyBillByPeriod: vi.fn().mockResolvedValue(null),
                    distinctCurrencies: vi.fn().mockResolvedValue(["eure"]),
                    create,
                    findById,
                },
                assetLogs: { findByMerchantAndDateRange, sumSettledByToken },
            });

            await orchestrator.generateMonthlyBill(
                "merchant-1",
                { periodStart: new Date("2026-02-01T00:00:00.000Z") },
                "0x0000000000000000000000000000000000000002"
            );

            expect(findByMerchantAndDateRange).toHaveBeenCalledTimes(1);
        });

        it("rowCount comes from the grouped COUNT query, not the (possibly capped) per-row fetch length", async () => {
            const created = makeMonthlyBillDoc();
            const create = vi.fn().mockResolvedValue(created);
            const findById = vi.fn().mockResolvedValue(created);
            // Simulate the per-row fetch being capped well below the real count.
            const findByMerchantAndDateRange = vi.fn().mockResolvedValue([]);
            const countSettledByMerchantAndDateRange = vi
                .fn()
                .mockResolvedValue(7321);
            // Non-empty so `buildAnnexData` doesn't take its zero-rewards
            // early return (which skips the COUNT query entirely).
            const sumSettledByToken = vi
                .fn()
                .mockResolvedValue([
                    { tokenAddress: currentStablecoins.eure, total: "10" },
                ]);

            const orchestrator = makeOrchestrator({
                billingDocuments: {
                    findMonthlyBillByPeriod: vi.fn().mockResolvedValue(null),
                    distinctCurrencies: vi.fn().mockResolvedValue(["eure"]),
                    create,
                    findById,
                },
                assetLogs: {
                    findByMerchantAndDateRange,
                    sumSettledByToken,
                    countSettledByMerchantAndDateRange,
                },
            });

            await orchestrator.generateMonthlyBill(
                "merchant-1",
                { periodStart: new Date("2026-02-01T00:00:00.000Z") },
                "0x0000000000000000000000000000000000000002"
            );

            const createArg = create.mock.calls[0][0];
            expect(createArg.details.annexRowCount).toBe(7321);
        });
    });

    describe("multi-currency invoice totals (B9/B13)", () => {
        it("grossAmount/netAmount include only the primary currency's rewards, excluding other stablecoins and unknown tokens", async () => {
            const create = vi.fn().mockResolvedValue(makeMonthlyBillDoc());
            // Primary currency resolves from `distinctCurrencies` (billing docs)
            // — "eure" is first, so it's the bill's primary/document currency.
            const distinctCurrencies = vi.fn().mockResolvedValue(["eure"]);
            const sumSettledByToken = vi
                .fn()
                // before
                .mockResolvedValueOnce([])
                // in-period: eure (primary, counted) + usdc (other stablecoin,
                // excluded) + an unknown/non-stablecoin token (excluded)
                .mockResolvedValueOnce([
                    { tokenAddress: currentStablecoins.eure, total: "100" },
                    { tokenAddress: currentStablecoins.usdc, total: "999" },
                    {
                        tokenAddress:
                            "0x0000000000000000000000000000000000000099",
                        total: "777",
                    },
                ]);

            const orchestrator = makeOrchestrator({
                billingDocuments: {
                    findMonthlyBillByPeriod: vi.fn().mockResolvedValue(null),
                    distinctCurrencies,
                    create,
                },
                assetLogs: { sumSettledByToken },
            });

            await orchestrator.generateMonthlyBill(
                "merchant-1",
                { periodStart: new Date("2026-02-01T00:00:00.000Z") },
                "0x0000000000000000000000000000000000000002"
            );

            const createArg = create.mock.calls[0][0];
            expect(createArg.currency).toBe("eure");
            // rewardBaseAmount = 100 (eure only); totalHt = 100 * 1.20 = 120;
            // non-FR merchant (no accountingInfo) => vatApplicable false =>
            // totalTtc = totalHt = 120. The 999 (usdc) and 777 (unknown token)
            // must NOT be folded in.
            expect(createArg.netAmount).toBe("120.000000000000000000");
            expect(createArg.grossAmount).toBe("120.000000000000000000");
        });

        it("regeneratePdf pins the primary currency to the row's frozen currency column, not a re-derived currencies[0]", async () => {
            // Regression: `distinctCurrencies` (SELECT DISTINCT) can return a
            // different order across calls, and `updateMonthlyBillDetails`
            // never updates the row's `currency` column — so regenerating a
            // usdc-labeled bill while `distinctCurrencies` now leads with
            // "eure" must still sum rewardBaseAmount in usdc, keeping the
            // frozen amounts in agreement with the document's labeled
            // currency (and the PDF recap, which filters by dto.currency).
            const usdcBill = makeMonthlyBillDoc({ currency: "usdc" });
            const updateMonthlyBillDetails = vi
                .fn()
                .mockResolvedValue(usdcBill);
            const orchestrator = makeOrchestrator({
                billingDocuments: {
                    findById: vi.fn().mockResolvedValue(usdcBill),
                    // Re-derived order now leads with "eure" — must be ignored.
                    distinctCurrencies: vi
                        .fn()
                        .mockResolvedValue(["eure", "usdc"]),
                    updateMonthlyBillDetails,
                    setPdf: vi.fn().mockResolvedValue(usdcBill),
                },
                assetLogs: {
                    sumSettledByToken: vi
                        .fn()
                        .mockResolvedValueOnce([]) // before
                        .mockResolvedValueOnce([
                            {
                                tokenAddress: currentStablecoins.eure,
                                total: "999",
                            },
                            {
                                tokenAddress: currentStablecoins.usdc,
                                total: "100",
                            },
                        ]), // in-period
                },
            });

            await orchestrator.regeneratePdf("merchant-1", "bill-1");

            const [, , , amounts] = updateMonthlyBillDetails.mock.calls[0];
            // usdc (the row's frozen currency) only: 100 * 1.20 = 120 — the
            // eure 999 must NOT leak in even though eure is currencies[0].
            expect(amounts.grossAmount).toBe("120.000000000000000000");
            expect(amounts.netAmount).toBe("120.000000000000000000");
        });
    });

    describe("reward deduction (address comparison regression)", () => {
        it("subtracts settled rewards from the ledger even though the DB returns lowercase token addresses", async () => {
            // Regression for the address-comparison blocker: `row.tokenAddress`
            // as returned by the repository is lowercase (customHex.fromDriver
            // -> viem's bytesToHex), while the ledger builder derives its
            // comparison address via `getTokenAddressForStablecoin`, which is
            // the EIP-55 checksummed constant. A raw `===` between the two
            // never matches, silently zeroing the reward deduction. This test
            // fails against that buggy code (it would assert `"1000"` instead
            // of `"800"` below) and passes only with `isAddressEqual`.
            const create = vi.fn().mockResolvedValue(makeMonthlyBillDoc());
            const lowercaseEure = currentStablecoins.eure.toLowerCase();

            const orchestrator = makeOrchestrator({
                billingDocuments: {
                    findMonthlyBillByPeriod: vi.fn().mockResolvedValue(null),
                    distinctCurrencies: vi.fn().mockResolvedValue(["eure"]),
                    aggregateDepositWithdrawByCurrency: vi
                        .fn()
                        .mockResolvedValueOnce([
                            {
                                currency: "eure",
                                deposited: "1000",
                                withdrawn: "0",
                            },
                        ]) // before
                        .mockResolvedValueOnce([
                            {
                                currency: "eure",
                                deposited: "0",
                                withdrawn: "0",
                            },
                        ]), // in-period
                    create,
                },
                assetLogs: {
                    sumSettledByToken: vi
                        .fn()
                        .mockResolvedValueOnce([
                            { tokenAddress: lowercaseEure, total: "200" },
                        ]) // before
                        .mockResolvedValueOnce([
                            { tokenAddress: lowercaseEure, total: "50" },
                        ]), // in-period
                },
            });

            await orchestrator.generateMonthlyBill(
                "merchant-1",
                { periodStart: new Date("2026-02-01T00:00:00.000Z") },
                "0x0000000000000000000000000000000000000002"
            );

            const createArg = create.mock.calls[0][0];
            const eureLedger = createArg.details.ledgers.find(
                (l: { currency: string }) => l.currency === "eure"
            );
            // openingBalance = depositedBefore(1000) - withdrawnBefore(0) -
            // rewardedBefore(200) = 800; closingBalance = 800 + 0 - 0 - 50 =
            // 750. Against the pre-fix `===` code both rewardedBefore/
            // InPeriod resolve to "0" and this would read 1000 / 1000
            // instead (the reward deductions silently dropped).
            expect(eureLedger.openingBalance).toBe("800.000000000000000000");
            expect(eureLedger.closingBalance).toBe("750.000000000000000000");
        });
    });

    describe("query boundary wiring", () => {
        it("passes half-open [periodStart, periodEnd) boundaries to the grouped sum queries", async () => {
            const create = vi.fn().mockResolvedValue(makeMonthlyBillDoc());
            const aggregateDepositWithdrawByCurrency = vi
                .fn()
                .mockResolvedValue([]);
            const sumSettledByToken = vi.fn().mockResolvedValue([]);

            const orchestrator = makeOrchestrator({
                billingDocuments: {
                    findMonthlyBillByPeriod: vi.fn().mockResolvedValue(null),
                    aggregateDepositWithdrawByCurrency,
                    create,
                },
                assetLogs: { sumSettledByToken },
            });

            const periodStart = new Date("2026-02-01T00:00:00.000Z");
            const periodEnd = new Date("2026-03-01T00:00:00.000Z");

            await orchestrator.generateMonthlyBill(
                "merchant-1",
                { periodStart },
                "0x0000000000000000000000000000000000000002"
            );

            expect(aggregateDepositWithdrawByCurrency).toHaveBeenCalledWith(
                "merchant-1",
                { before: periodStart }
            );
            expect(aggregateDepositWithdrawByCurrency).toHaveBeenCalledWith(
                "merchant-1",
                { start: periodStart, end: periodEnd }
            );
            expect(sumSettledByToken).toHaveBeenCalledWith("merchant-1", {
                before: periodStart,
            });
            expect(sumSettledByToken).toHaveBeenCalledWith("merchant-1", {
                start: periodStart,
                end: periodEnd,
            });
        });
    });

    describe("PDF generation is best-effort", () => {
        it("still returns the created document when PDF rendering rejects", async () => {
            const created = makeMonthlyBillDoc();
            const create = vi.fn().mockResolvedValue(created);
            const findById = vi.fn().mockResolvedValue(created);
            const render = vi
                .fn()
                .mockRejectedValue(new Error("render failed"));
            const setPdf = vi.fn();

            const orchestrator = makeOrchestrator({
                billingDocuments: {
                    findMonthlyBillByPeriod: vi.fn().mockResolvedValue(null),
                    create,
                    findById,
                    setPdf,
                },
                pdf: { render },
            });

            const result = await orchestrator.generateMonthlyBill(
                "merchant-1",
                { periodStart: new Date("2026-02-01T00:00:00.000Z") },
                "0x0000000000000000000000000000000000000002"
            );

            expect(result.id).toBe(created.id);
            expect(setPdf).not.toHaveBeenCalled();
        });
    });

    describe("documentDate reference-year", () => {
        it("dates a December bill in the billed year (last instant of the period, not periodEnd)", async () => {
            const create = vi.fn().mockResolvedValue(makeMonthlyBillDoc());
            const orchestrator = makeOrchestrator({
                billingDocuments: {
                    findMonthlyBillByPeriod: vi.fn().mockResolvedValue(null),
                    create,
                },
            });

            await orchestrator.generateMonthlyBill(
                "merchant-1",
                { periodStart: new Date("2026-12-01T00:00:00.000Z") },
                "0x0000000000000000000000000000000000000002"
            );

            const createArg = create.mock.calls[0][0];
            // periodEnd is 2027-01-01T00:00:00Z; documentDate must be 1ms
            // before that (still in 2026) so the reference bucket stays 2026.
            expect(createArg.periodEnd).toEqual(
                new Date("2027-01-01T00:00:00.000Z")
            );
            expect(createArg.documentDate).toEqual(
                new Date("2026-12-31T23:59:59.999Z")
            );
            expect(createArg.documentDate.getUTCFullYear()).toBe(2026);
        });
    });

    describe("regeneratePdf", () => {
        it("recomputes details and re-renders a monthly bill missing its PDF", async () => {
            const stale = makeMonthlyBillDoc({ pdfGeneratedAt: null });
            const refreshed = makeMonthlyBillDoc({ pdfGeneratedAt: null });
            const findById = vi
                .fn()
                .mockResolvedValueOnce(stale) // initial lookup
                .mockResolvedValueOnce(refreshed); // final read-back
            const updateMonthlyBillDetails = vi
                .fn()
                .mockResolvedValue(refreshed);
            const setPdf = vi.fn().mockResolvedValue(refreshed);
            const render = vi
                .fn()
                .mockResolvedValue(new Uint8Array([37, 80, 68, 70]));

            const orchestrator = makeOrchestrator({
                billingDocuments: {
                    findById,
                    updateMonthlyBillDetails,
                    distinctCurrencies: vi.fn().mockResolvedValue(["eure"]),
                    aggregateDepositWithdrawByCurrency: vi
                        .fn()
                        .mockResolvedValue([]),
                    setPdf,
                },
                pdf: { render },
            });

            await orchestrator.regeneratePdf("merchant-1", "bill-1");

            expect(updateMonthlyBillDetails).toHaveBeenCalledTimes(1);
            expect(render).toHaveBeenCalledTimes(1);
            expect(setPdf).toHaveBeenCalledTimes(1);
        });

        it("is a no-op for a bill that already has a PDF (write-once)", async () => {
            const withPdf = makeMonthlyBillDoc({
                pdfGeneratedAt: new Date(),
                pdfStorageKey: "merchant-1/monthly_bill/bill-1.pdf",
            });
            const updateMonthlyBillDetails = vi.fn();
            const render = vi.fn();

            const orchestrator = makeOrchestrator({
                billingDocuments: {
                    findById: vi.fn().mockResolvedValue(withPdf),
                    updateMonthlyBillDetails,
                },
                pdf: { render },
            });

            const result = await orchestrator.regeneratePdf(
                "merchant-1",
                "bill-1"
            );

            expect(updateMonthlyBillDetails).not.toHaveBeenCalled();
            expect(render).not.toHaveBeenCalled();
            expect(result?.id).toBe(withPdf.id);
        });
    });

    describe("backfillAllMerchantBills", () => {
        const fullAccountingInfo = {
            companyName: "Acme",
            vatNumber: "FR123",
            streetAddress: "1 rue",
            city: "Paris",
            postalCode: "75001",
            country: "FR",
            billingEmail: "a@b.co",
        };

        it("skips merchants without accounting info or without any deposit", async () => {
            const noInfo = {
                id: "m-noinfo",
                createdAt: new Date("2026-01-01T00:00:00.000Z"),
                accountingInfo: null,
            };
            const noDeposit = {
                id: "m-nodep",
                createdAt: new Date("2026-01-01T00:00:00.000Z"),
                accountingInfo: fullAccountingInfo,
            };
            const findAll = vi.fn().mockResolvedValue([noInfo, noDeposit]);
            const findOldestDepositDate = vi.fn().mockResolvedValue(null);
            const listMonthlyBillPeriodStarts = vi.fn().mockResolvedValue([]);
            const create = vi.fn();

            const orchestrator = makeOrchestrator({
                merchant: { findAll },
                billingDocuments: {
                    findOldestDepositDate,
                    listMonthlyBillPeriodStarts,
                    create,
                },
            });

            const result = await orchestrator.backfillAllMerchantBills();

            expect(create).not.toHaveBeenCalled();
            // Only the info-complete merchant reaches the deposit gate.
            expect(findOldestDepositDate).toHaveBeenCalledTimes(1);
            expect(findOldestDepositDate).toHaveBeenCalledWith("m-nodep");
            expect(result).toEqual({
                merchantsConsidered: 2,
                merchantsBilled: 0,
                billsCreated: 0,
            });
        });

        it("backfills missing data-only bills from the oldest deposit up to (excluding) the current month", async () => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date("2026-04-15T00:00:00.000Z"));
            try {
                const merchant = {
                    id: "merchant-1",
                    createdAt: new Date("2026-02-01T00:00:00.000Z"),
                    accountingInfo: fullAccountingInfo,
                };
                const findAll = vi.fn().mockResolvedValue([merchant]);
                const findOldestDepositDate = vi
                    .fn()
                    .mockResolvedValue(new Date("2026-02-10T00:00:00.000Z"));
                const listMonthlyBillPeriodStarts = vi
                    .fn()
                    .mockResolvedValue([]);
                const create = vi
                    .fn()
                    .mockImplementation((doc) =>
                        Promise.resolve(makeMonthlyBillDoc(doc))
                    );
                const findById = vi
                    .fn()
                    .mockResolvedValue(makeMonthlyBillDoc());
                const render = vi.fn();

                const orchestrator = makeOrchestrator({
                    merchant: { findAll },
                    billingDocuments: {
                        findOldestDepositDate,
                        listMonthlyBillPeriodStarts,
                        create,
                        findById,
                    },
                    pdf: { render },
                });

                const result = await orchestrator.backfillAllMerchantBills();

                // Feb + Mar 2026 (Apr is the current, still-open month).
                const periodStarts = create.mock.calls.map(([doc]) =>
                    (doc.periodStart as Date).toISOString()
                );
                expect(periodStarts).toEqual([
                    "2026-02-01T00:00:00.000Z",
                    "2026-03-01T00:00:00.000Z",
                ]);
                // Data-only: no PDF rendered at generation time.
                expect(render).not.toHaveBeenCalled();
                expect(result).toEqual({
                    merchantsConsidered: 1,
                    merchantsBilled: 1,
                    billsCreated: 2,
                });
            } finally {
                vi.useRealTimers();
            }
        });

        it("skips months that already have a bill", async () => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date("2026-04-15T00:00:00.000Z"));
            try {
                const merchant = {
                    id: "merchant-1",
                    createdAt: new Date("2026-02-01T00:00:00.000Z"),
                    accountingInfo: fullAccountingInfo,
                };
                const findAll = vi.fn().mockResolvedValue([merchant]);
                const findOldestDepositDate = vi
                    .fn()
                    .mockResolvedValue(new Date("2026-02-10T00:00:00.000Z"));
                // February already billed — only March should be generated.
                const listMonthlyBillPeriodStarts = vi
                    .fn()
                    .mockResolvedValue([new Date("2026-02-01T00:00:00.000Z")]);
                const create = vi
                    .fn()
                    .mockImplementation((doc) =>
                        Promise.resolve(makeMonthlyBillDoc(doc))
                    );
                const findById = vi
                    .fn()
                    .mockResolvedValue(makeMonthlyBillDoc());

                const orchestrator = makeOrchestrator({
                    merchant: { findAll },
                    billingDocuments: {
                        findOldestDepositDate,
                        listMonthlyBillPeriodStarts,
                        create,
                        findById,
                    },
                });

                const result = await orchestrator.backfillAllMerchantBills();

                expect(create).toHaveBeenCalledTimes(1);
                expect(
                    (create.mock.calls[0][0].periodStart as Date).toISOString()
                ).toBe("2026-03-01T00:00:00.000Z");
                expect(result.billsCreated).toBe(1);
            } finally {
                vi.useRealTimers();
            }
        });
    });
});
