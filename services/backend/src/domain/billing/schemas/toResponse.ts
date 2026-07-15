import type { BillingDocumentSelect } from "../db/schema";
import type { BillingDocumentResponse } from "./index";

/**
 * Maps a persisted `billing_documents` row to its API response shape. Lives in
 * its own module (not `schemas/index.ts`) so the schema/validation layer stays
 * free of a `db/schema` import: `db/schema.ts` types its columns from the
 * schema types here, so the reverse edge would form a cycle
 * (`db/schema` → `schemas/index` → `db/schema`).
 */
export function toBillingDocumentResponse(
    doc: BillingDocumentSelect
): BillingDocumentResponse {
    return {
        id: doc.id,
        merchantId: doc.merchantId,
        kind: doc.kind,
        reference: doc.reference,
        documentDate: doc.documentDate.toISOString(),
        periodStart: doc.periodStart?.toISOString() ?? null,
        periodEnd: doc.periodEnd?.toISOString() ?? null,
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
