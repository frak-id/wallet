import { describe, expect, it, vi } from "vitest";
import type { BillingDocumentSelect } from "../../domain/billing/db/schema";
import type { BillingDocumentRepository } from "../../domain/billing/repositories/BillingDocumentRepository";
import type { BillingStorageRepository } from "../../domain/billing/repositories/BillingStorageRepository";
import { BillingComputationService } from "../../domain/billing/services/BillingComputationService";
import type { BillingPdfService } from "../../domain/billing/services/BillingPdfService";
import type { MerchantRepository } from "../../domain/merchant/repositories/MerchantRepository";
import type { AssetLogRepository } from "../../domain/rewards/repositories/AssetLogRepository";
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
        pdf: Partial<BillingPdfService>;
    }> = {}
) {
    const billingDocuments = {
        findById: vi.fn(),
        create: vi.fn(),
        void: vi.fn(),
        setPdf: vi.fn(),
        ...overrides.billingDocuments,
    } as unknown as BillingDocumentRepository;

    const billingStorage = {
        upload: vi.fn().mockResolvedValue("merchant-1/deposit/doc-1.pdf"),
        ...overrides.billingStorage,
    } as unknown as BillingStorageRepository;

    const merchant = {
        findById: vi.fn().mockResolvedValue(null),
        ...overrides.merchant,
    } as unknown as MerchantRepository;

    const assetLogs = {
        sumSettledAmountSince: vi.fn().mockResolvedValue("0"),
        ...overrides.assetLogs,
    } as unknown as AssetLogRepository;

    const computation = new BillingComputationService();

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
        pdf
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
});
