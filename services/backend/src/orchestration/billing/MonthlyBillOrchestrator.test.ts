import { currentStablecoins } from "@frak-labs/app-essentials";
import { describe, expect, it, vi } from "vitest";
import type { BillingDocumentSelect } from "../../domain/billing/db/schema";
import type { BillingDocumentRepository } from "../../domain/billing/repositories/BillingDocumentRepository";
import type { BillingStorageRepository } from "../../domain/billing/repositories/BillingStorageRepository";
import { BillingComputationService } from "../../domain/billing/services/BillingComputationService";
import type { BillingPdfService } from "../../domain/billing/services/BillingPdfService";
import type { CampaignBankRepository } from "../../domain/campaign-bank/repositories/CampaignBankRepository";
import type { MerchantRepository } from "../../domain/merchant/repositories/MerchantRepository";
import type { AssetLogRepository } from "../../domain/rewards/repositories/AssetLogRepository";
import type { BalancesRepository } from "../../domain/wallet/repositories/BalancesRepository";
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
        campaignBank: Partial<CampaignBankRepository>;
        pricing: Partial<PricingRepository>;
        balances: Partial<BalancesRepository>;
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
        ...overrides.assetLogs,
    } as unknown as AssetLogRepository;

    const campaignBank = {
        getBankOnChainState: vi.fn(),
        ...overrides.campaignBank,
    } as unknown as CampaignBankRepository;

    const computation = new BillingComputationService();

    const pdf = {
        render: vi.fn().mockResolvedValue(new Uint8Array([37, 80, 68, 70])),
        ...overrides.pdf,
    } as unknown as BillingPdfService;

    const pricing = {
        getTokenPrice: vi.fn().mockResolvedValue({ eur: 1, usd: 1, gbp: 1 }),
        ...overrides.pricing,
    } as unknown as PricingRepository;

    const balances = {
        getTokenMetadataBatch: vi.fn().mockResolvedValue(new Map()),
        ...overrides.balances,
    } as unknown as BalancesRepository;

    return new MonthlyBillOrchestrator(
        billingDocuments,
        billingStorage,
        merchant,
        assetLogs,
        campaignBank,
        computation,
        pdf,
        pricing,
        balances
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

    describe("on-chain divergence check", () => {
        it("skips (does not block generation) when the merchant has no bankAddress", async () => {
            const create = vi.fn().mockResolvedValue(makeMonthlyBillDoc());
            const orchestrator = makeOrchestrator({
                billingDocuments: {
                    findMonthlyBillByPeriod: vi.fn().mockResolvedValue(null),
                    create,
                },
                merchant: {
                    findById: vi.fn().mockResolvedValue({
                        id: "merchant-1",
                        bankAddress: null,
                    }),
                },
            });

            await orchestrator.generateMonthlyBill(
                "merchant-1",
                { periodStart: new Date("2026-02-01T00:00:00.000Z") },
                "0x0000000000000000000000000000000000000002"
            );

            const createArg = create.mock.calls[0][0];
            expect(createArg.details.review.skipped).toBe(true);
            expect(createArg.details.review.flagged).toBe(false);
        });

        it("skips (best-effort) when the on-chain read throws", async () => {
            const create = vi.fn().mockResolvedValue(makeMonthlyBillDoc());
            const orchestrator = makeOrchestrator({
                billingDocuments: {
                    findMonthlyBillByPeriod: vi.fn().mockResolvedValue(null),
                    distinctCurrencies: vi.fn().mockResolvedValue(["eure"]),
                    create,
                },
                merchant: {
                    findById: vi.fn().mockResolvedValue({
                        id: "merchant-1",
                        bankAddress:
                            "0x0000000000000000000000000000000000000003",
                    }),
                },
                campaignBank: {
                    getBankOnChainState: vi
                        .fn()
                        .mockRejectedValue(new Error("rpc down")),
                },
            });

            const result = await orchestrator.generateMonthlyBill(
                "merchant-1",
                { periodStart: new Date("2026-02-01T00:00:00.000Z") },
                "0x0000000000000000000000000000000000000002"
            );

            const createArg = create.mock.calls[0][0];
            expect(createArg.details.review.skipped).toBe(true);
            expect(createArg.details.review.skipReason).toBe(
                "on-chain read failed"
            );
            expect(result).toBeDefined();
        });

        it("flags when the derived balance diverges from the on-chain balance beyond threshold", async () => {
            const create = vi.fn().mockResolvedValue(makeMonthlyBillDoc());
            const orchestrator = makeOrchestrator({
                billingDocuments: {
                    findMonthlyBillByPeriod: vi.fn().mockResolvedValue(null),
                    distinctCurrencies: vi.fn().mockResolvedValue(["eure"]),
                    aggregateDepositWithdrawByCurrency: vi
                        .fn()
                        .mockResolvedValue([
                            {
                                currency: "eure",
                                deposited: "1000",
                                withdrawn: "0",
                            },
                        ]),
                    create,
                },
                merchant: {
                    findById: vi.fn().mockResolvedValue({
                        id: "merchant-1",
                        bankAddress:
                            "0x0000000000000000000000000000000000000003",
                    }),
                },
                campaignBank: {
                    getBankOnChainState: vi.fn().mockResolvedValue({
                        isOpen: true,
                        balances: new Map([
                            [
                                currentStablecoins.eure,
                                // 1000 derived vs 1 on-chain (scaled) -> large divergence
                                1n * 10n ** 18n,
                            ],
                        ]),
                        allowances: new Map(),
                    }),
                },
                balances: {
                    getTokenMetadataBatch: vi.fn().mockResolvedValue(
                        new Map([
                            [
                                currentStablecoins.eure,
                                {
                                    symbol: "EURe",
                                    decimals: 18,
                                    name: "EURe",
                                },
                            ],
                        ])
                    ),
                },
            });

            await orchestrator.generateMonthlyBill(
                "merchant-1",
                { periodStart: new Date("2026-02-01T00:00:00.000Z") },
                "0x0000000000000000000000000000000000000002"
            );

            const createArg = create.mock.calls[0][0];
            expect(createArg.details.review.flagged).toBe(true);
            expect(createArg.details.review.perCurrency).toHaveLength(1);
        });
    });
});
