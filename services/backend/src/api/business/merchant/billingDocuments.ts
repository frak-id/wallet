import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { BillingContext } from "../../../domain/billing/context";
import {
    BillingDocumentKindSchema,
    BillingDocumentResponseSchema,
    toBillingDocumentResponse,
} from "../../../domain/billing/schemas";
import { MerchantIdParamSchema } from "../../schemas";
import { businessSessionContext } from "../middleware/session";

const ListDocumentsQuerySchema = t.Object({
    kind: t.Optional(BillingDocumentKindSchema),
    from: t.Optional(t.String({ format: "date-time" })),
    to: t.Optional(t.String({ format: "date-time" })),
});

const ListDocumentsResponseSchema = t.Object({
    documents: t.Array(BillingDocumentResponseSchema),
});

/**
 * Merchant-facing billing document reads (billing-feature-plan.md §5). Guarded
 * by `hasMerchantAccess` (owner/admin, with the read-only platform-admin
 * safe-method bypass) — mirrors `billingAccounting.ts`'s auth pattern exactly.
 * Never `platformAdminAuthenticated` (that guard is for the admin CRUD/mutation
 * routes in `billing.ts` only).
 */
export const merchantBillingDocumentRoutes = new Elysia({
    prefix: "/:merchantId/billing",
})
    .use(businessSessionContext)
    .get(
        "/documents",
        async ({
            params: { merchantId },
            query: { kind, from, to },
            businessSession,
            shopifySession,
            hasMerchantAccess,
        }) => {
            if (!businessSession && !shopifySession) {
                return status(401, "Authentication required");
            }

            const hasAccess = await hasMerchantAccess(merchantId);
            if (!hasAccess) {
                return status(403, "Access denied");
            }

            const documents =
                await BillingContext.repositories.billingDocument.findByMerchant(
                    merchantId,
                    {
                        kind,
                        from: from ? new Date(from) : undefined,
                        to: to ? new Date(to) : undefined,
                    }
                );

            return {
                documents: documents.map(toBillingDocumentResponse),
            };
        },
        {
            params: MerchantIdParamSchema,
            query: ListDocumentsQuerySchema,
            response: {
                200: ListDocumentsResponseSchema,
                401: t.String(),
                403: t.String(),
            },
        }
    )
    .get(
        "/documents/:id/pdf",
        async ({
            params: { merchantId, id },
            businessSession,
            shopifySession,
            hasMerchantAccess,
        }) => {
            if (!businessSession && !shopifySession) {
                return status(401, "Authentication required");
            }

            const hasAccess = await hasMerchantAccess(merchantId);
            if (!hasAccess) {
                return status(403, "Access denied");
            }

            const document =
                await BillingContext.repositories.billingDocument.findById(
                    merchantId,
                    id
                );
            if (!document) {
                return status(404, "Document not found");
            }
            if (!document.pdfStorageKey) {
                return status(404, "PDF not generated");
            }

            const bytes = await BillingContext.repositories.billingStorage.read(
                document.pdfStorageKey
            );

            return new Response(Buffer.from(bytes), {
                headers: {
                    "Content-Type": "application/pdf",
                    "Content-Disposition": `attachment; filename="${document.reference}.pdf"`,
                },
            });
        },
        {
            params: t.Object({ merchantId: t.String(), id: t.String() }),
            response: {
                401: t.String(),
                403: t.String(),
                404: t.String(),
            },
        }
    );
