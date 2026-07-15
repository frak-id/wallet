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
    BillingOrchestrator,
    DepositNotFoundError,
    WithdrawValidationError,
} from "./BillingOrchestrator";

function makeDeposit(
    overrides: Partial<BillingDocumentSelect> = {}
): BillingDocumentSelect {
    return {
        id: "deposit-1",
        merchantId: "merchant-1",
        kind: "deposit",
        reference: "DEP-2026-0001",
        documentDate: new Date("2026-01-01T00:00:00.000Z"),
        periodStart: null,
        periodEnd: null,
        currency: "eure",
        grossAmount: "1200",
        netAmount: "800",
        txHash: null,
        linkedDepositId: null,
        details: {
            kind: "deposit",
            vatAmount: "200",
            frakFeeAmount: "200",
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
        findById: vi.fn(),
        create: vi.fn(),
        void: vi.fn(),
        setPdf: vi.fn(),
        clearPdf: vi.fn(),
        findWithdrawsByLinkedDeposit: vi.fn().mockResolvedValue([]),
        findMonthlyBillsCovering: vi.fn().mockResolvedValue([]),
        ...overrides.billingDocuments,
    } as unknown as BillingDocumentRepository;

    const billingStorage = {
        upload: vi.fn().mockResolvedValue("merchant-1/deposit/doc-1.pdf"),
        delete: vi.fn().mockResolvedValue(undefined),
        ...overrides.billingStorage,
    } as unknown as BillingStorageRepository;

    const merchant = {
        findById: vi.fn().mockResolvedValue(null),
        ...overrides.merchant,
    } as unknown as MerchantRepository;

    const assetLogs = {
        distinctSettledTokensSince: vi.fn().mockResolvedValue([]),
        sumSettledConvertedSince: vi.fn().mockResolvedValue("0"),
        ...overrides.assetLogs,
    } as unknown as AssetLogRepository;

    const computation = new BillingComputationService();

    const pricing = {
        getTokenPrice: vi.fn().mockResolvedValue({ eur: 1, usd: 1, gbp: 1 }),
        ...overrides.pricing,
    } as unknown as PricingRepository;

    const pdf = {
        render: vi.fn().mockResolvedValue(new Uint8Array([37, 80, 68, 70])),
        ...overrides.pdf,
    } as unknown as BillingPdfService;

    return new BillingOrchestrator(
        billingDocuments,
        billingStorage,
        merchant,
        assetLogs,
        computation,
        pdf,
        pricing
    );
}

describe("BillingOrchestrator", () => {
    describe("voidDocument", () => {
        it("returns null when the document is not found", async () => {
            const findById = vi.fn().mockResolvedValue(null);
            const voidFn = vi.fn();
            const orchestrator = makeOrchestrator({
                billingDocuments: { findById, void: voidFn },
            });

            const result = await orchestrator.voidDocument(
                "merchant-1",
                "doc-1",
                "deposit"
            );

            expect(result).toBeNull();
            expect(voidFn).not.toHaveBeenCalled();
        });

        it("returns null on kind mismatch (cross-kind IDOR guard)", async () => {
            const findById = vi
                .fn()
                .mockResolvedValue(makeDeposit({ kind: "withdraw" }));
            const voidFn = vi.fn();
            const orchestrator = makeOrchestrator({
                billingDocuments: { findById, void: voidFn },
            });

            const result = await orchestrator.voidDocument(
                "merchant-1",
                "doc-1",
                "deposit"
            );

            expect(result).toBeNull();
            expect(voidFn).not.toHaveBeenCalled();
        });

        it("calls billingDocuments.void when the kind matches", async () => {
            const doc = makeDeposit();
            const findById = vi.fn().mockResolvedValue(doc);
            const voidFn = vi.fn().mockResolvedValue({
                ...doc,
                voidedAt: new Date(),
            });
            const orchestrator = makeOrchestrator({
                billingDocuments: { findById, void: voidFn },
            });

            const result = await orchestrator.voidDocument(
                "merchant-1",
                "doc-1",
                "deposit"
            );

            expect(voidFn).toHaveBeenCalledWith("merchant-1", "doc-1");
            expect(result?.voidedAt).not.toBeNull();
        });

        it("cascades: voids linked withdraws and clears dependent monthly-bill PDFs", async () => {
            const deposit = makeDeposit();
            const linkedWithdraw = makeDeposit({
                id: "withdraw-1",
                kind: "withdraw",
                linkedDepositId: "deposit-1",
            });
            const affectedBill = makeDeposit({
                id: "bill-1",
                kind: "monthly_bill",
                pdfStorageKey: "merchant-1/monthly_bill/bill-1.pdf",
            });
            const findById = vi.fn().mockResolvedValue(deposit);
            const voidFn = vi
                .fn()
                .mockResolvedValue({ ...deposit, voidedAt: new Date() });
            const findWithdrawsByLinkedDeposit = vi
                .fn()
                .mockResolvedValue([linkedWithdraw]);
            const findMonthlyBillsCovering = vi
                .fn()
                .mockResolvedValue([affectedBill]);
            const clearPdf = vi.fn().mockResolvedValue(affectedBill);
            const storageDelete = vi.fn().mockResolvedValue(undefined);

            const orchestrator = makeOrchestrator({
                billingDocuments: {
                    findById,
                    void: voidFn,
                    findWithdrawsByLinkedDeposit,
                    findMonthlyBillsCovering,
                    clearPdf,
                },
                billingStorage: { delete: storageDelete },
            });

            await orchestrator.voidDocument(
                "merchant-1",
                "deposit-1",
                "deposit"
            );

            // deposit itself + the linked withdraw both voided
            expect(voidFn).toHaveBeenCalledWith("merchant-1", "deposit-1");
            expect(voidFn).toHaveBeenCalledWith("merchant-1", "withdraw-1");
            // dependent monthly bill's cached PDF deleted + detached
            expect(storageDelete).toHaveBeenCalledWith(
                "merchant-1/monthly_bill/bill-1.pdf"
            );
            expect(clearPdf).toHaveBeenCalledWith("merchant-1", "bill-1");
        });

        it("(B11) clears the DB pointer (clearPdf) BEFORE deleting the stored object", async () => {
            const deposit = makeDeposit();
            const affectedBill = makeDeposit({
                id: "bill-1",
                kind: "monthly_bill",
                pdfStorageKey: "merchant-1/monthly_bill/bill-1.pdf",
            });
            const callOrder: string[] = [];
            const findById = vi.fn().mockResolvedValue(deposit);
            const voidFn = vi
                .fn()
                .mockResolvedValue({ ...deposit, voidedAt: new Date() });
            const findMonthlyBillsCovering = vi
                .fn()
                .mockResolvedValue([affectedBill]);
            const clearPdf = vi.fn().mockImplementation(async () => {
                callOrder.push("clearPdf");
                return affectedBill;
            });
            const storageDelete = vi.fn().mockImplementation(async () => {
                callOrder.push("storageDelete");
            });

            const orchestrator = makeOrchestrator({
                billingDocuments: {
                    findById,
                    void: voidFn,
                    findMonthlyBillsCovering,
                    clearPdf,
                },
                billingStorage: { delete: storageDelete },
            });

            await orchestrator.voidDocument(
                "merchant-1",
                "deposit-1",
                "deposit"
            );

            expect(callOrder).toEqual(["clearPdf", "storageDelete"]);
        });

        it("(B11) a storage-delete failure after a successful clearPdf never re-throws (best-effort)", async () => {
            const deposit = makeDeposit();
            const affectedBill = makeDeposit({
                id: "bill-1",
                kind: "monthly_bill",
                pdfStorageKey: "merchant-1/monthly_bill/bill-1.pdf",
            });
            const findById = vi.fn().mockResolvedValue(deposit);
            const voidFn = vi
                .fn()
                .mockResolvedValue({ ...deposit, voidedAt: new Date() });
            const findMonthlyBillsCovering = vi
                .fn()
                .mockResolvedValue([affectedBill]);
            const clearPdf = vi.fn().mockResolvedValue(affectedBill);
            const storageDelete = vi
                .fn()
                .mockRejectedValue(new Error("storage unavailable"));

            const orchestrator = makeOrchestrator({
                billingDocuments: {
                    findById,
                    void: voidFn,
                    findMonthlyBillsCovering,
                    clearPdf,
                },
                billingStorage: { delete: storageDelete },
            });

            const result = await orchestrator.voidDocument(
                "merchant-1",
                "deposit-1",
                "deposit"
            );

            // The deposit void itself still succeeds; clearPdf already ran, so
            // the row no longer points at the (now orphaned) deleted object.
            expect(result?.voidedAt).not.toBeNull();
            expect(clearPdf).toHaveBeenCalledWith("merchant-1", "bill-1");
        });

        it("does not cascade when voiding a withdraw", async () => {
            const withdraw = makeDeposit({ kind: "withdraw" });
            const findWithdrawsByLinkedDeposit = vi.fn();
            const orchestrator = makeOrchestrator({
                billingDocuments: {
                    findById: vi.fn().mockResolvedValue(withdraw),
                    void: vi.fn().mockResolvedValue({
                        ...withdraw,
                        voidedAt: new Date(),
                    }),
                    findWithdrawsByLinkedDeposit,
                },
            });

            await orchestrator.voidDocument(
                "merchant-1",
                "withdraw-1",
                "withdraw"
            );

            expect(findWithdrawsByLinkedDeposit).not.toHaveBeenCalled();
        });
    });

    describe("createWithdraw guards", () => {
        const baseInput = {
            remainingBankAmount: "400",
            currency: "eure" as const,
            documentDate: new Date("2026-02-01T00:00:00.000Z"),
            linkedDepositId: "deposit-1",
            rawIban: "FR7630006000011234567890189",
        };
        const createdBy = "0x0000000000000000000000000000000000000002" as const;

        it("throws DepositNotFoundError when the linked deposit does not exist", async () => {
            const findById = vi.fn().mockResolvedValue(null);
            const orchestrator = makeOrchestrator({
                billingDocuments: { findById },
            });

            await expect(
                orchestrator.createWithdraw("merchant-1", baseInput, createdBy)
            ).rejects.toBeInstanceOf(DepositNotFoundError);
        });

        it("throws WithdrawValidationError when the linked document is not a deposit", async () => {
            const findById = vi
                .fn()
                .mockResolvedValue(makeDeposit({ kind: "withdraw" }));
            const orchestrator = makeOrchestrator({
                billingDocuments: { findById },
            });

            await expect(
                orchestrator.createWithdraw("merchant-1", baseInput, createdBy)
            ).rejects.toBeInstanceOf(WithdrawValidationError);
        });

        it("throws WithdrawValidationError when the linked deposit is voided", async () => {
            const findById = vi
                .fn()
                .mockResolvedValue(makeDeposit({ voidedAt: new Date() }));
            const orchestrator = makeOrchestrator({
                billingDocuments: { findById },
            });

            await expect(
                orchestrator.createWithdraw("merchant-1", baseInput, createdBy)
            ).rejects.toBeInstanceOf(WithdrawValidationError);
        });

        it("throws WithdrawValidationError on currency mismatch", async () => {
            const findById = vi
                .fn()
                .mockResolvedValue(makeDeposit({ currency: "usdc" }));
            const orchestrator = makeOrchestrator({
                billingDocuments: { findById },
            });

            await expect(
                orchestrator.createWithdraw("merchant-1", baseInput, createdBy)
            ).rejects.toBeInstanceOf(WithdrawValidationError);
        });
    });

    describe("createWithdraw cross-currency reward conversion", () => {
        const createdBy = "0x0000000000000000000000000000000000000005" as const;
        const baseInput = {
            remainingBankAmount: "400",
            currency: "eure" as const,
            documentDate: new Date("2026-02-01T00:00:00.000Z"),
            linkedDepositId: "deposit-1",
            rawIban: "FR7630006000011234567890189",
        };

        it("converts rewards to the deposit currency (deposit token counts 1:1, other tokens scaled by price ratio)", async () => {
            const deposit = makeDeposit({ currency: "eure" });
            const findById = vi
                .fn()
                .mockResolvedValueOnce(deposit) // linked deposit lookup
                .mockResolvedValueOnce(deposit); // final read-back
            const create = vi.fn().mockResolvedValue(deposit);

            // Merchant rewards in both EURe (deposit token) and USDC.
            const distinctSettledTokensSince = vi
                .fn()
                .mockResolvedValue([
                    currentStablecoins.eure,
                    currentStablecoins.usdc,
                ]);
            const sumSettledConvertedSince = vi.fn().mockResolvedValue("0");

            // EURe priced in EUR at 1; USDC priced in EUR at 0.9 -> factor 0.9
            // for USDC, 1.0 for the EURe deposit token.
            const getTokenPrice = vi.fn().mockImplementation(({ token }) => {
                if (token === currentStablecoins.usdc) {
                    return Promise.resolve({ eur: 0.9, usd: 1, gbp: 0.8 });
                }
                return Promise.resolve({ eur: 1, usd: 1.1, gbp: 0.85 });
            });

            const orchestrator = makeOrchestrator({
                billingDocuments: {
                    findById,
                    create,
                    setPdf: vi.fn(),
                },
                assetLogs: {
                    distinctSettledTokensSince,
                    sumSettledConvertedSince,
                },
                pricing: { getTokenPrice },
            });

            await orchestrator.createWithdraw(
                "merchant-1",
                baseInput,
                createdBy
            );

            // The converted-sum query is used (never the naive all-token sum).
            expect(sumSettledConvertedSince).toHaveBeenCalledTimes(1);
            const [, , factors] = sumSettledConvertedSince.mock.calls[0];
            const factorMap = factors as Map<string, number>;
            // Deposit token (EURe) is exactly 1:1.
            expect(factorMap.get(currentStablecoins.eure)).toBeCloseTo(1, 12);
            // USDC converted at eur ratio 0.9 / 1 = 0.9.
            expect(factorMap.get(currentStablecoins.usdc)).toBeCloseTo(0.9, 12);
        });

        it("returns a 0 ratio (no conversion) when no settled reward tokens exist", async () => {
            const deposit = makeDeposit({ currency: "eure" });
            const findById = vi
                .fn()
                .mockResolvedValueOnce(deposit)
                .mockResolvedValueOnce(deposit);
            const create = vi.fn().mockResolvedValue(deposit);
            const distinctSettledTokensSince = vi.fn().mockResolvedValue([]);
            const sumSettledConvertedSince = vi.fn();

            const orchestrator = makeOrchestrator({
                billingDocuments: { findById, create, setPdf: vi.fn() },
                assetLogs: {
                    distinctSettledTokensSince,
                    sumSettledConvertedSince,
                },
            });

            await orchestrator.createWithdraw(
                "merchant-1",
                baseInput,
                createdBy
            );

            // No tokens -> no converted-sum query, ratio numerator is "0".
            expect(sumSettledConvertedSince).not.toHaveBeenCalled();
            const details = create.mock.calls[0][0].details;
            expect(details.distributedRatio).toBe("0.000000000000000000");
        });
    });

    describe("reissueDeposit (void + re-emit)", () => {
        const input = {
            grossAmount: "1200",
            currency: "eure" as const,
            documentDate: new Date("2026-03-01T00:00:00.000Z"),
            country: "FR",
        };
        const createdBy = "0x0000000000000000000000000000000000000003" as const;

        it("returns null and does not create when the original can't be voided", async () => {
            const findById = vi.fn().mockResolvedValue(null); // not found
            const create = vi.fn();
            const orchestrator = makeOrchestrator({
                billingDocuments: { findById, void: vi.fn(), create },
            });

            const result = await orchestrator.reissueDeposit(
                "merchant-1",
                "deposit-1",
                input,
                createdBy
            );

            expect(result).toBeNull();
            expect(create).not.toHaveBeenCalled();
        });

        it("voids the original then emits a fresh deposit", async () => {
            const original = makeDeposit();
            const reissued = makeDeposit({
                id: "deposit-2",
                reference: "DEP-2026-0002",
            });
            const findById = vi.fn().mockResolvedValue(original);
            const voidFn = vi
                .fn()
                .mockResolvedValue({ ...original, voidedAt: new Date() });
            const create = vi.fn().mockResolvedValue(reissued);
            const setPdf = vi.fn().mockResolvedValue(reissued);
            const orchestrator = makeOrchestrator({
                billingDocuments: { findById, void: voidFn, create, setPdf },
            });

            const result = await orchestrator.reissueDeposit(
                "merchant-1",
                "deposit-1",
                input,
                createdBy
            );

            expect(voidFn).toHaveBeenCalledWith("merchant-1", "deposit-1");
            expect(create).toHaveBeenCalledTimes(1);
            expect(result?.id).toBe("deposit-2");
        });

        it("(B10) carries a non-voided linked withdraw over to the reissued deposit", async () => {
            const original = makeDeposit();
            const linkedWithdraw = makeDeposit({
                id: "withdraw-1",
                kind: "withdraw",
                linkedDepositId: "deposit-1",
                currency: "eure",
                documentDate: new Date("2026-02-01T00:00:00.000Z"),
                txHash: "0xaaaa000000000000000000000000000000000000000000000000000000aa",
                details: {
                    kind: "withdraw",
                    remainingBankAmount: "300",
                    distributedRatio: "0.5",
                    restitutedVat: "10",
                    restitutedFrakFee: "10",
                    bankSent: "320",
                    maskedIban: "FR76 **** **** **** 123",
                    note: "original note",
                },
            });
            const reissuedDeposit = makeDeposit({
                id: "deposit-2",
                reference: "DEP-2026-0002",
            });
            const recreatedWithdraw = makeDeposit({
                id: "withdraw-2",
                kind: "withdraw",
                linkedDepositId: "deposit-2",
            });

            // First findById call resolves the deposit being voided; the linked
            // deposit lookup inside the withdraw re-create resolves the NEW
            // deposit (so its currency/void checks pass).
            const findById = vi
                .fn()
                .mockResolvedValueOnce(original) // voidDocument(deposit-1) lookup
                .mockResolvedValueOnce(reissuedDeposit); // createWithdraw's linked-deposit lookup
            const voidFn = vi
                .fn()
                .mockResolvedValue({ ...original, voidedAt: new Date() });
            const findWithdrawsByLinkedDeposit = vi
                .fn()
                .mockResolvedValue([linkedWithdraw]);
            const create = vi
                .fn()
                .mockResolvedValueOnce(reissuedDeposit) // new deposit
                .mockResolvedValueOnce(recreatedWithdraw); // re-created withdraw

            const orchestrator = makeOrchestrator({
                billingDocuments: {
                    findById,
                    void: voidFn,
                    findWithdrawsByLinkedDeposit,
                    create,
                    setPdf: vi.fn(),
                },
            });

            const result = await orchestrator.reissueDeposit(
                "merchant-1",
                "deposit-1",
                input,
                createdBy
            );

            expect(result?.id).toBe("deposit-2");
            // Second `create` call is the carried-over withdraw, linked to the
            // NEW deposit, using the original's frozen inputs.
            expect(create).toHaveBeenCalledTimes(2);
            const withdrawCreateArg = create.mock.calls[1][0];
            expect(withdrawCreateArg.kind).toBe("withdraw");
            expect(withdrawCreateArg.linkedDepositId).toBe("deposit-2");
            expect(withdrawCreateArg.grossAmount).toBe("300");
        });

        it("(B10) a failure re-creating one linked withdraw does not fail the reissue itself", async () => {
            const original = makeDeposit();
            const linkedWithdraw = makeDeposit({
                id: "withdraw-1",
                kind: "withdraw",
                linkedDepositId: "deposit-1",
                details: {
                    kind: "withdraw",
                    remainingBankAmount: "300",
                    distributedRatio: "0.5",
                    restitutedVat: "10",
                    restitutedFrakFee: "10",
                    bankSent: "320",
                    maskedIban: "FR76 **** **** **** 123",
                },
            });
            const reissuedDeposit = makeDeposit({
                id: "deposit-2",
                reference: "DEP-2026-0002",
            });
            const findById = vi
                .fn()
                .mockResolvedValueOnce(original)
                .mockResolvedValueOnce(null); // linked-deposit lookup fails inside createWithdraw
            const voidFn = vi
                .fn()
                .mockResolvedValue({ ...original, voidedAt: new Date() });
            const findWithdrawsByLinkedDeposit = vi
                .fn()
                .mockResolvedValue([linkedWithdraw]);
            const create = vi.fn().mockResolvedValueOnce(reissuedDeposit);

            const orchestrator = makeOrchestrator({
                billingDocuments: {
                    findById,
                    void: voidFn,
                    findWithdrawsByLinkedDeposit,
                    create,
                    setPdf: vi.fn(),
                },
            });

            const result = await orchestrator.reissueDeposit(
                "merchant-1",
                "deposit-1",
                input,
                createdBy
            );

            // The deposit reissue itself still succeeds even though the
            // withdraw carry-over failed (best-effort, logged).
            expect(result?.id).toBe("deposit-2");
            expect(create).toHaveBeenCalledTimes(1);
        });
    });

    describe("createDeposit lazy PDF + bill invalidation", () => {
        const createdBy = "0x0000000000000000000000000000000000000007" as const;
        const input = {
            grossAmount: "1200",
            currency: "eure" as const,
            documentDate: new Date("2026-02-15T00:00:00.000Z"),
            country: "FR",
        };

        it("does not render/store a PDF at create time (lazy on first download)", async () => {
            const deposit = makeDeposit();
            const render = vi.fn();
            const upload = vi.fn();
            const setPdf = vi.fn();
            const orchestrator = makeOrchestrator({
                billingDocuments: {
                    create: vi.fn().mockResolvedValue(deposit),
                    findById: vi.fn().mockResolvedValue(deposit),
                    setPdf,
                },
                billingStorage: { upload },
                pdf: { render },
            });

            await orchestrator.createDeposit("merchant-1", input, createdBy);

            expect(render).not.toHaveBeenCalled();
            expect(upload).not.toHaveBeenCalled();
            expect(setPdf).not.toHaveBeenCalled();
        });

        it("(B14) returns the freshly created row directly, without a redundant findById re-fetch", async () => {
            const deposit = makeDeposit();
            const findById = vi.fn();
            const orchestrator = makeOrchestrator({
                billingDocuments: {
                    create: vi.fn().mockResolvedValue(deposit),
                    findById,
                    findMonthlyBillsCovering: vi.fn().mockResolvedValue([]),
                },
            });

            const result = await orchestrator.createDeposit(
                "merchant-1",
                input,
                createdBy
            );

            expect(result).toBe(deposit);
            expect(findById).not.toHaveBeenCalled();
        });

        it("clears the cached PDF of monthly bills covering the deposit date", async () => {
            const deposit = makeDeposit({ documentDate: input.documentDate });
            const coveringBill = makeDeposit({
                id: "bill-9",
                kind: "monthly_bill",
                pdfStorageKey: "merchant-1/monthly_bill/bill-9.pdf",
            });
            const findMonthlyBillsCovering = vi
                .fn()
                .mockResolvedValue([coveringBill]);
            const clearPdf = vi.fn().mockResolvedValue(coveringBill);
            const storageDelete = vi.fn().mockResolvedValue(undefined);
            const orchestrator = makeOrchestrator({
                billingDocuments: {
                    create: vi.fn().mockResolvedValue(deposit),
                    findById: vi.fn().mockResolvedValue(deposit),
                    findMonthlyBillsCovering,
                    clearPdf,
                },
                billingStorage: { delete: storageDelete },
            });

            await orchestrator.createDeposit("merchant-1", input, createdBy);

            expect(findMonthlyBillsCovering).toHaveBeenCalledWith(
                "merchant-1",
                input.documentDate
            );
            expect(storageDelete).toHaveBeenCalledWith(
                "merchant-1/monthly_bill/bill-9.pdf"
            );
            expect(clearPdf).toHaveBeenCalledWith("merchant-1", "bill-9");
        });
    });

    describe("createWithdraw (B14 no dead re-fetch)", () => {
        it("returns the freshly created row directly, without a redundant findById re-fetch", async () => {
            const deposit = makeDeposit();
            const createdWithdraw = makeDeposit({
                id: "withdraw-1",
                kind: "withdraw",
                linkedDepositId: "deposit-1",
            });
            const findById = vi.fn().mockResolvedValueOnce(deposit); // linked-deposit lookup only
            const orchestrator = makeOrchestrator({
                billingDocuments: {
                    findById,
                    create: vi.fn().mockResolvedValue(createdWithdraw),
                    findMonthlyBillsCovering: vi.fn().mockResolvedValue([]),
                },
            });

            const result = await orchestrator.createWithdraw(
                "merchant-1",
                {
                    remainingBankAmount: "400",
                    currency: "eure",
                    documentDate: new Date("2026-02-01T00:00:00.000Z"),
                    linkedDepositId: "deposit-1",
                    rawIban: "FR7630006000011234567890189",
                },
                "0x0000000000000000000000000000000000000006"
            );

            expect(result).toBe(createdWithdraw);
            // Only the linked-deposit lookup call, no post-create re-fetch.
            expect(findById).toHaveBeenCalledTimes(1);
        });
    });

    describe("reissueWithdraw (void + re-emit)", () => {
        it("returns null and does not create when the original can't be voided", async () => {
            const findById = vi
                .fn()
                .mockResolvedValue(makeDeposit({ kind: "deposit" })); // wrong kind for a withdraw void
            const create = vi.fn();
            const orchestrator = makeOrchestrator({
                billingDocuments: { findById, void: vi.fn(), create },
            });

            const result = await orchestrator.reissueWithdraw(
                "merchant-1",
                "withdraw-1",
                {
                    remainingBankAmount: "400",
                    currency: "eure",
                    documentDate: new Date("2026-03-01T00:00:00.000Z"),
                    linkedDepositId: "deposit-1",
                    rawIban: "FR7630006000011234567890189",
                },
                "0x0000000000000000000000000000000000000004"
            );

            expect(result).toBeNull();
            expect(create).not.toHaveBeenCalled();
        });
    });
});
