import type { Stablecoin } from "@frak-labs/app-essentials";
import type { Address, Hex } from "viem";
import type {
    BillingDocumentInsert,
    BillingDocumentSelect,
} from "../../domain/billing/db/schema";
import type { BillingDocumentRepository } from "../../domain/billing/repositories/BillingDocumentRepository";
import type { BillingStorageRepository } from "../../domain/billing/repositories/BillingStorageRepository";
import type { BillingDocumentDetails } from "../../domain/billing/schemas";
import type { BillingComputationService } from "../../domain/billing/services/BillingComputationService";
import type { BillingPdfService } from "../../domain/billing/services/BillingPdfService";
import type { MerchantRepository } from "../../domain/merchant/repositories/MerchantRepository";
import type { AssetLogRepository } from "../../domain/rewards/repositories/AssetLogRepository";

export class DepositNotFoundError extends Error {
    constructor(depositId: string) {
        super(`Linked deposit ${depositId} not found for this merchant`);
    }
}

export class DepositAlreadyVoidedError extends Error {
    constructor(depositId: string) {
        super(`Linked deposit ${depositId} is voided`);
    }
}

export class NotADepositError extends Error {
    constructor(depositId: string) {
        super(`Document ${depositId} is not a deposit`);
    }
}

export class CurrencyMismatchError extends Error {
    constructor(depositId: string) {
        super(
            `Withdraw currency does not match linked deposit ${depositId}'s currency`
        );
    }
}

type CreateDepositInput = {
    grossAmount: string;
    currency: Stablecoin;
    documentDate: Date;
    country: string;
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
        private readonly pdf: BillingPdfService
    ) {}

    async createDeposit(
        merchantId: string,
        input: CreateDepositInput,
        createdBy: Address
    ): Promise<BillingDocumentSelect> {
        const { vatAmount, frakFeeAmount, netAmount } =
            this.computation.computeDeposit({
                grossAmount: input.grossAmount,
                country: input.country,
            });

        const details: BillingDocumentDetails = {
            kind: "deposit",
            vatAmount,
            frakFeeAmount,
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

        await this.generateAndStorePdf(document);

        return (
            (await this.billingDocuments.findById(merchantId, document.id)) ??
            document
        );
    }

    async createWithdraw(
        merchantId: string,
        input: CreateWithdrawInput,
        createdBy: Address
    ): Promise<BillingDocumentSelect> {
        const linkedDeposit = await this.billingDocuments.findById(
            merchantId,
            input.linkedDepositId
        );
        if (!linkedDeposit) {
            throw new DepositNotFoundError(input.linkedDepositId);
        }
        if (linkedDeposit.kind !== "deposit") {
            throw new NotADepositError(input.linkedDepositId);
        }
        if (linkedDeposit.voidedAt) {
            throw new DepositAlreadyVoidedError(input.linkedDepositId);
        }
        if (linkedDeposit.details?.kind !== "deposit") {
            throw new NotADepositError(input.linkedDepositId);
        }
        if (linkedDeposit.currency !== input.currency) {
            throw new CurrencyMismatchError(input.linkedDepositId);
        }

        const rewardsDistributedSinceDeposit =
            await this.assetLogs.sumSettledAmountSince(
                merchantId,
                linkedDeposit.documentDate
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

        await this.generateAndStorePdf(document);

        return (
            (await this.billingDocuments.findById(merchantId, document.id)) ??
            document
        );
    }

    /**
     * Voids a document, asserting it matches the expected `kind` (the
     * deposit/withdraw void routes are separate endpoints, and neither should
     * be able to void the other's documents by guessing an id).
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
        return this.billingDocuments.void(merchantId, id);
    }

    /**
     * Re-renders and stores the PDF for a document that doesn't have one yet
     * (e.g. a prior create's render/upload step failed). No-op (returns the
     * document unchanged) if a PDF was already issued — `setPdf` is
     * write-once (§3.6).
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
        const accountingInfo = merchant?.accountingInfo ?? {};
        const buyer = {
            companyName: accountingInfo.companyName,
            vatNumber: accountingInfo.vatNumber,
            addressLines: [
                accountingInfo.streetAddress,
                [accountingInfo.postalCode, accountingInfo.city]
                    .filter(Boolean)
                    .join(" "),
            ].filter((line): line is string => Boolean(line)),
        };

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
