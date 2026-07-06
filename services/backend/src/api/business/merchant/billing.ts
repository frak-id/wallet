import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import type { BillingDocumentSelect } from "../../../domain/billing/db/schema";
import { BillingDocumentKindSchema } from "../../../domain/billing/schemas";
import {
    DepositNotFoundError,
    WithdrawValidationError,
} from "../../../orchestration/billing/BillingOrchestrator";
import { MonthlyBillAlreadyExistsError } from "../../../orchestration/billing/MonthlyBillOrchestrator";
import { OrchestrationContext } from "../../../orchestration/context";
import { MerchantIdParamSchema } from "../../schemas";
import { businessSessionContext } from "../middleware/session";

const StablecoinSchema = t.Union([
    t.Literal("eure"),
    t.Literal("gbpe"),
    t.Literal("usde"),
    t.Literal("usdc"),
]);

const BillingDocumentResponseSchema = t.Object({
    id: t.String(),
    merchantId: t.String(),
    kind: BillingDocumentKindSchema,
    reference: t.String(),
    documentDate: t.String(),
    currency: StablecoinSchema,
    grossAmount: t.Union([t.String(), t.Null()]),
    netAmount: t.Union([t.String(), t.Null()]),
    txHash: t.Union([t.Hex(), t.Null()]),
    linkedDepositId: t.Union([t.String(), t.Null()]),
    pdfGeneratedAt: t.Union([t.String(), t.Null()]),
    voidedAt: t.Union([t.String(), t.Null()]),
    createdAt: t.Union([t.String(), t.Null()]),
});

function toResponse(doc: BillingDocumentSelect) {
    return {
        id: doc.id,
        merchantId: doc.merchantId,
        kind: doc.kind,
        reference: doc.reference,
        documentDate: doc.documentDate.toISOString(),
        currency: doc.currency,
        grossAmount: doc.grossAmount,
        netAmount: doc.netAmount,
        txHash: doc.txHash,
        linkedDepositId: doc.linkedDepositId,
        pdfGeneratedAt: doc.pdfGeneratedAt?.toISOString() ?? null,
        voidedAt: doc.voidedAt?.toISOString() ?? null,
        createdAt: doc.createdAt?.toISOString() ?? null,
    };
}

const DecimalStringSchema = t.String({ pattern: "^\\d+(\\.\\d+)?$" });

const CreateDepositBodySchema = t.Object({
    grossAmount: DecimalStringSchema,
    currency: StablecoinSchema,
    documentDate: t.String({ format: "date-time" }),
    country: t.String({ pattern: "^[A-Z]{2}$" }),
    paymentPlatform: t.Optional(
        t.Union([t.Literal("shopify"), t.Literal("stripe")])
    ),
    note: t.Optional(t.String({ maxLength: 2000 })),
    txHash: t.Optional(t.Hex()),
});

const CreateWithdrawBodySchema = t.Object({
    remainingBankAmount: DecimalStringSchema,
    currency: StablecoinSchema,
    documentDate: t.String({ format: "date-time" }),
    linkedDepositId: t.String(),
    // The frontend already obfuscates this before sending (§3.5); the
    // backend re-masks defensively regardless of what's received here.
    rawIban: t.String({ maxLength: 64 }),
    note: t.Optional(t.String({ maxLength: 2000 })),
    txHash: t.Optional(t.Hex()),
});

const GenerateMonthlyBillBodySchema = t.Object({
    // "YYYY-MM", e.g. "2026-02" — the calendar month to generate (§6.4).
    month: t.String({ pattern: "^\\d{4}-(0[1-9]|1[0-2])$" }),
});

function parsePeriodStart(month: string): Date {
    const [year, monthNum] = month.split("-").map(Number);
    return new Date(Date.UTC(year as number, (monthNum as number) - 1, 1));
}

/**
 * Admin-only deposit/withdraw CRUD (billing-feature-plan.md §5 Phase 2).
 * Guarded by `platformAdminAuthenticated` — never `hasMerchantAccess`, whose
 * platform-admin bypass is read-only/safe-methods-only (see session.ts).
 * Every handler still re-derives `businessSession.wallet` for `createdBy`.
 */
export const merchantBillingAdminRoutes = new Elysia({
    prefix: "/:merchantId/billing",
})
    .use(businessSessionContext)
    .post(
        "/deposits",
        async ({ params: { merchantId }, body, businessSession }) => {
            if (!businessSession) {
                return status(401, "Authentication required");
            }

            const document =
                await OrchestrationContext.orchestrators.billing.createDeposit(
                    merchantId,
                    {
                        grossAmount: body.grossAmount,
                        currency: body.currency,
                        documentDate: new Date(body.documentDate),
                        country: body.country,
                        paymentPlatform: body.paymentPlatform,
                        note: body.note,
                        txHash: body.txHash,
                    },
                    businessSession.wallet
                );

            return toResponse(document);
        },
        {
            platformAdminAuthenticated: true,
            params: MerchantIdParamSchema,
            body: CreateDepositBodySchema,
            response: {
                200: BillingDocumentResponseSchema,
                401: t.String(),
                403: t.String(),
            },
        }
    )
    .post(
        "/withdrawals",
        async ({ params: { merchantId }, body, businessSession }) => {
            if (!businessSession) {
                return status(401, "Authentication required");
            }

            try {
                const document =
                    await OrchestrationContext.orchestrators.billing.createWithdraw(
                        merchantId,
                        {
                            remainingBankAmount: body.remainingBankAmount,
                            currency: body.currency,
                            documentDate: new Date(body.documentDate),
                            linkedDepositId: body.linkedDepositId,
                            rawIban: body.rawIban,
                            note: body.note,
                            txHash: body.txHash,
                        },
                        businessSession.wallet
                    );

                return toResponse(document);
            } catch (err) {
                if (err instanceof DepositNotFoundError) {
                    return status(404, err.message);
                }
                if (err instanceof WithdrawValidationError) {
                    return status(400, err.message);
                }
                throw err;
            }
        },
        {
            platformAdminAuthenticated: true,
            params: MerchantIdParamSchema,
            body: CreateWithdrawBodySchema,
            response: {
                200: BillingDocumentResponseSchema,
                400: t.String(),
                401: t.String(),
                403: t.String(),
                404: t.String(),
            },
        }
    )
    .put(
        "/deposits/:id",
        async ({ params: { merchantId, id }, body, businessSession }) => {
            if (!businessSession) {
                return status(401, "Authentication required");
            }

            const document =
                await OrchestrationContext.orchestrators.billing.reissueDeposit(
                    merchantId,
                    id,
                    {
                        grossAmount: body.grossAmount,
                        currency: body.currency,
                        documentDate: new Date(body.documentDate),
                        country: body.country,
                        paymentPlatform: body.paymentPlatform,
                        note: body.note,
                        txHash: body.txHash,
                    },
                    businessSession.wallet
                );
            if (!document) {
                return status(404, "Document not found or already voided");
            }

            return toResponse(document);
        },
        {
            platformAdminAuthenticated: true,
            params: t.Object({ merchantId: t.String(), id: t.String() }),
            body: CreateDepositBodySchema,
            response: {
                200: BillingDocumentResponseSchema,
                401: t.String(),
                403: t.String(),
                404: t.String(),
            },
        }
    )
    .put(
        "/withdrawals/:id",
        async ({ params: { merchantId, id }, body, businessSession }) => {
            if (!businessSession) {
                return status(401, "Authentication required");
            }

            try {
                const document =
                    await OrchestrationContext.orchestrators.billing.reissueWithdraw(
                        merchantId,
                        id,
                        {
                            remainingBankAmount: body.remainingBankAmount,
                            currency: body.currency,
                            documentDate: new Date(body.documentDate),
                            linkedDepositId: body.linkedDepositId,
                            rawIban: body.rawIban,
                            note: body.note,
                            txHash: body.txHash,
                        },
                        businessSession.wallet
                    );
                if (!document) {
                    return status(404, "Document not found or already voided");
                }

                return toResponse(document);
            } catch (err) {
                if (err instanceof DepositNotFoundError) {
                    return status(404, err.message);
                }
                if (err instanceof WithdrawValidationError) {
                    return status(400, err.message);
                }
                throw err;
            }
        },
        {
            platformAdminAuthenticated: true,
            params: t.Object({ merchantId: t.String(), id: t.String() }),
            body: CreateWithdrawBodySchema,
            response: {
                200: BillingDocumentResponseSchema,
                400: t.String(),
                401: t.String(),
                403: t.String(),
                404: t.String(),
            },
        }
    )
    .post(
        "/monthly-bills",
        async ({ params: { merchantId }, body, businessSession }) => {
            if (!businessSession) {
                return status(401, "Authentication required");
            }

            try {
                const document =
                    await OrchestrationContext.orchestrators.monthlyBill.generateMonthlyBill(
                        merchantId,
                        { periodStart: parsePeriodStart(body.month) },
                        businessSession.wallet
                    );

                return toResponse(document);
            } catch (err) {
                if (err instanceof MonthlyBillAlreadyExistsError) {
                    return status(409, toResponse(err.existing));
                }
                throw err;
            }
        },
        {
            platformAdminAuthenticated: true,
            params: MerchantIdParamSchema,
            body: GenerateMonthlyBillBodySchema,
            response: {
                200: BillingDocumentResponseSchema,
                401: t.String(),
                403: t.String(),
                409: BillingDocumentResponseSchema,
            },
        }
    )
    .delete(
        "/deposits/:id",
        async ({ params: { merchantId, id } }) => {
            const voided =
                await OrchestrationContext.orchestrators.billing.voidDocument(
                    merchantId,
                    id,
                    "deposit"
                );
            if (!voided) {
                return status(404, "Document not found or already voided");
            }
            return status(204);
        },
        {
            platformAdminAuthenticated: true,
            params: t.Object({ merchantId: t.String(), id: t.String() }),
            response: {
                204: t.Void(),
                401: t.String(),
                403: t.String(),
                404: t.String(),
            },
        }
    )
    .delete(
        "/withdrawals/:id",
        async ({ params: { merchantId, id } }) => {
            const voided =
                await OrchestrationContext.orchestrators.billing.voidDocument(
                    merchantId,
                    id,
                    "withdraw"
                );
            if (!voided) {
                return status(404, "Document not found or already voided");
            }
            return status(204);
        },
        {
            platformAdminAuthenticated: true,
            params: t.Object({ merchantId: t.String(), id: t.String() }),
            response: {
                204: t.Void(),
                401: t.String(),
                403: t.String(),
                404: t.String(),
            },
        }
    );
