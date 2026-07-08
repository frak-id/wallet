import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import {
    BillingDocumentResponseSchema,
    StablecoinSchema,
    toBillingDocumentResponse as toResponse,
} from "../../../domain/billing/schemas";
import {
    DepositNotFoundError,
    WithdrawValidationError,
} from "../../../orchestration/billing/BillingOrchestrator";
import { OrchestrationContext } from "../../../orchestration/context";
import { MerchantIdParamSchema } from "../../schemas";
import { businessSessionContext } from "../middleware/session";

const DecimalStringSchema = t.String({ pattern: "^\\d+(\\.\\d+)?$" });

const CreateDepositBodySchema = t.Object({
    grossAmount: DecimalStringSchema,
    currency: StablecoinSchema,
    documentDate: t.String({ format: "date-time" }),
    country: t.String({ pattern: "^[A-Z]{2}$" }),
    // Offered top-up added back to the net (§4); defaults to "0" server-side.
    giftedAmount: t.Optional(DecimalStringSchema),
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

// Document-scoped routes carry both the merchant and the document uuid. Both
// map to `uuid` columns, so the id is validated as a uuid here (a malformed
// id 404s at the schema boundary instead of reaching Postgres as a 500).
const BillingDocumentParamSchema = t.Object({
    merchantId: t.String(),
    id: t.String({ format: "uuid" }),
});

/**
 * Maps a validated deposit request body to the orchestrator's create/reissue
 * input DTO (shared by POST and PUT deposit routes, which take the same body).
 */
function toDepositInput(body: typeof CreateDepositBodySchema.static) {
    return {
        grossAmount: body.grossAmount,
        currency: body.currency,
        documentDate: new Date(body.documentDate),
        country: body.country,
        giftedAmount: body.giftedAmount,
        paymentPlatform: body.paymentPlatform,
        note: body.note,
        txHash: body.txHash,
    };
}

/**
 * Maps a validated withdraw request body to the orchestrator's create/reissue
 * input DTO (shared by POST and PUT withdraw routes, which take the same body).
 */
function toWithdrawInput(body: typeof CreateWithdrawBodySchema.static) {
    return {
        remainingBankAmount: body.remainingBankAmount,
        currency: body.currency,
        documentDate: new Date(body.documentDate),
        linkedDepositId: body.linkedDepositId,
        rawIban: body.rawIban,
        note: body.note,
        txHash: body.txHash,
    };
}

/**
 * Maps a withdraw-assembly error to its HTTP response. Returns the matching
 * `status(...)` for the known validation errors, or `undefined` when the
 * error is none of them — the caller must then rethrow so it surfaces as a
 * 500 rather than being swallowed.
 */
function mapWithdrawError(err: unknown) {
    if (err instanceof DepositNotFoundError) {
        return status(404, err.message);
    }
    if (err instanceof WithdrawValidationError) {
        return status(400, err.message);
    }
    return undefined;
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
                    toDepositInput(body),
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
                        toWithdrawInput(body),
                        businessSession.wallet
                    );

                return toResponse(document);
            } catch (err) {
                const mapped = mapWithdrawError(err);
                if (!mapped) throw err;
                return mapped;
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
                    toDepositInput(body),
                    businessSession.wallet
                );
            if (!document) {
                return status(404, "Document not found or already voided");
            }

            return toResponse(document);
        },
        {
            platformAdminAuthenticated: true,
            params: BillingDocumentParamSchema,
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
                        toWithdrawInput(body),
                        businessSession.wallet
                    );
                if (!document) {
                    return status(404, "Document not found or already voided");
                }

                return toResponse(document);
            } catch (err) {
                const mapped = mapWithdrawError(err);
                if (!mapped) throw err;
                return mapped;
            }
        },
        {
            platformAdminAuthenticated: true,
            params: BillingDocumentParamSchema,
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
            params: BillingDocumentParamSchema,
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
            params: BillingDocumentParamSchema,
            response: {
                204: t.Void(),
                401: t.String(),
                403: t.String(),
                404: t.String(),
            },
        }
    );
