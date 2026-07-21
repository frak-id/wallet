import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { BillingContext } from "../../../domain/billing/context";
import {
    BillingDocumentKindSchema,
    BillingDocumentResponseSchema,
} from "../../../domain/billing/schemas";
import { toBillingDocumentResponse } from "../../../domain/billing/schemas/toResponse";
import { OrchestrationContext } from "../../../orchestration/context";
import { MerchantIdParamSchema } from "../../schemas";
import { businessSessionContext } from "../middleware/session";

const DocumentIdParamSchema = t.Object({
    merchantId: t.String(),
    id: t.String({ format: "uuid" }),
});

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
 * by `requireMerchantAccess` / `getMerchantPermissions` (owner/admin, with the
 * read-only platform-admin grant) — mirrors `billingAccounting.ts`'s auth
 * pattern exactly. Never `platformAdminAuthenticated` (that guard is for the
 * admin CRUD/mutation routes in `billing.ts` only).
 */
export const merchantBillingDocumentRoutes = new Elysia({
    prefix: "/documents",
})
    .use(businessSessionContext)
    .get(
        "",
        async ({ params: { merchantId }, query: { kind, from, to } }) => {
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
            requireMerchantAccess: true,
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
        "/:id/pdf",
        async ({ params: { merchantId, id } }) => {
            let document =
                await BillingContext.repositories.billingDocument.findById(
                    merchantId,
                    id
                );
            if (!document) {
                return status(404, "Document not found");
            }

            // Lazy regeneration: a document whose first render/upload failed
            // (or a monthly bill whose cached PDF was cleared by a deposit
            // void) has no `pdfStorageKey`. Retry once here so the PDF becomes
            // downloadable without an explicit admin action — PDF failure is
            // never a hard blocker (§3.6/§6.3). Best-effort: if it still
            // fails, fall through to the 404 below.
            if (!document.pdfStorageKey) {
                const regenerated =
                    document.kind === "monthly_bill"
                        ? await OrchestrationContext.orchestrators.monthlyBill.regeneratePdf(
                              merchantId,
                              id
                          )
                        : await OrchestrationContext.orchestrators.billing.regeneratePdf(
                              merchantId,
                              id
                          );
                if (regenerated) {
                    document = regenerated;
                }
            }
            if (!document.pdfStorageKey) {
                return status(404, "PDF not generated");
            }

            // A stored key can dangle (its object deleted but the row's
            // pointer not yet cleared — e.g. a partially-failed bill
            // invalidation). Treat a failed read as "missing" — 404, never an
            // unhandled 500; the next create/void invalidation clears the
            // pointer and regeneration takes over.
            let bytes: Uint8Array;
            try {
                bytes = await BillingContext.repositories.billingStorage.read(
                    document.pdfStorageKey
                );
            } catch {
                return status(404, "PDF not generated");
            }

            return new Response(Buffer.from(bytes), {
                headers: {
                    "Content-Type": "application/pdf",
                    "Content-Disposition": `attachment; filename="${document.reference}.pdf"`,
                },
            });
        },
        {
            requireMerchantAccess: true,
            params: DocumentIdParamSchema,
            response: {
                401: t.String(),
                403: t.String(),
                404: t.String(),
            },
        }
    );
