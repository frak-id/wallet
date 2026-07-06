import { db } from "@backend-infrastructure";
import { and, eq, isNull } from "drizzle-orm";
import {
    type BillingDocumentInsert,
    type BillingDocumentSelect,
    billingDocumentsTable,
} from "../db/schema";
import type { BillingDocumentKind } from "../schemas";

/**
 * All queries are scoped by `merchantId` — never fetch a document by `id`
 * alone (prevents IDOR across merchants, see billing-feature-plan.md §5).
 */
export class BillingDocumentRepository {
    async findById(
        merchantId: string,
        id: string,
        { includeVoided = false }: { includeVoided?: boolean } = {}
    ): Promise<BillingDocumentSelect | null> {
        const result = await db.query.billingDocumentsTable.findFirst({
            where: and(
                eq(billingDocumentsTable.merchantId, merchantId),
                eq(billingDocumentsTable.id, id),
                includeVoided
                    ? undefined
                    : isNull(billingDocumentsTable.voidedAt)
            ),
        });
        return result ?? null;
    }

    async findByMerchant(
        merchantId: string,
        {
            kind,
            includeVoided = false,
        }: { kind?: BillingDocumentKind; includeVoided?: boolean } = {}
    ): Promise<BillingDocumentSelect[]> {
        return db.query.billingDocumentsTable.findMany({
            where: and(
                eq(billingDocumentsTable.merchantId, merchantId),
                kind ? eq(billingDocumentsTable.kind, kind) : undefined,
                includeVoided
                    ? undefined
                    : isNull(billingDocumentsTable.voidedAt)
            ),
        });
    }

    async create(
        document: BillingDocumentInsert
    ): Promise<BillingDocumentSelect> {
        const [result] = await db
            .insert(billingDocumentsTable)
            .values(document)
            .returning();
        if (!result) {
            throw new Error("Failed to create billing document");
        }
        return result;
    }

    async setPdf(
        merchantId: string,
        id: string,
        { pdfStorageKey }: { pdfStorageKey: string }
    ): Promise<BillingDocumentSelect | null> {
        const [result] = await db
            .update(billingDocumentsTable)
            .set({
                pdfStorageKey,
                pdfGeneratedAt: new Date(),
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(billingDocumentsTable.merchantId, merchantId),
                    eq(billingDocumentsTable.id, id)
                )
            )
            .returning();
        return result ?? null;
    }

    /**
     * Soft-delete (void) a document. Guarded by `isNull(voidedAt)` so a second
     * void on an already-voided row matches 0 rows and returns null rather than
     * overwriting the original retention timestamp (write-once — §3.6).
     */
    async void(
        merchantId: string,
        id: string
    ): Promise<BillingDocumentSelect | null> {
        const [result] = await db
            .update(billingDocumentsTable)
            .set({ voidedAt: new Date(), updatedAt: new Date() })
            .where(
                and(
                    eq(billingDocumentsTable.merchantId, merchantId),
                    eq(billingDocumentsTable.id, id),
                    isNull(billingDocumentsTable.voidedAt)
                )
            )
            .returning();
        return result ?? null;
    }
}
