import { db } from "@backend-infrastructure";
import { and, eq, isNull, sql } from "drizzle-orm";
import {
    type BillingDocumentInsert,
    type BillingDocumentSelect,
    billingDocumentsTable,
} from "../db/schema";
import type { BillingDocumentKind } from "../schemas";

/** Postgres transaction handle as passed to `db.transaction(async (tx) => …)`. */
type PgTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type PgRunner = typeof db | PgTx;

// Human-facing reference prefix per kind (billing-feature-plan.md §1/§3.2).
const REFERENCE_PREFIX: Record<BillingDocumentKind, string> = {
    deposit: "DEP",
    withdraw: "WDR",
    monthly_bill: "BILL",
};

const MAX_REFERENCE_ALLOC_ATTEMPTS = 2;

// Postgres unique_violation (23505). postgres-js surfaces the SQLSTATE code
// on the thrown error; duck-typed since the driver doesn't export a class.
function isUniqueReferenceViolation(err: unknown): boolean {
    return (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code?: string }).code === "23505"
    );
}

/**
 * All queries are scoped by `merchantId` — never fetch a document by `id`
 * alone (prevents IDOR across merchants, see billing-feature-plan.md §5).
 */
export class BillingDocumentRepository {
    /**
     * Atomically allocates the next `{PREFIX}-{year}-{NNNN}` reference for a
     * merchant+kind+year via `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`
     * against `billing_document_counters`. The row-level lock taken by the
     * upsert serializes concurrent allocations — no `SELECT MAX` race, and no
     * per-year Postgres `SEQUENCE` (which can't reset per merchant+kind+year
     * without runtime DDL — see schema.ts comment).
     *
     * Pass the enclosing `tx` so allocation commits atomically with the
     * document insert (`create` below) — a failed insert after a successful
     * bump would otherwise burn a reference number (gap; acceptable) but,
     * worse, could hand out the same number to a retried create (duplicate;
     * not acceptable without the transaction).
     */
    async nextReference(
        merchantId: string,
        kind: BillingDocumentKind,
        year: number,
        tx: PgRunner = db
    ): Promise<string> {
        const result = await tx.execute<{ last_value: number }>(sql`
            INSERT INTO billing_document_counters (merchant_id, kind, year, last_value)
            VALUES (${merchantId}::uuid, ${kind}, ${year}, 1)
            ON CONFLICT (merchant_id, kind, year)
            DO UPDATE SET last_value = billing_document_counters.last_value + 1
            RETURNING last_value
        `);
        const row = [...result][0];
        if (!row) {
            throw new Error(
                `Failed to allocate billing reference for merchant=${merchantId} kind=${kind} year=${year}`
            );
        }
        const counter = String(row.last_value).padStart(4, "0");
        return `${REFERENCE_PREFIX[kind]}-${year}-${counter}`;
    }
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

    /**
     * Allocates the reference and inserts the document atomically (same `tx`).
     * `documentDate`'s UTC year drives the reference counter bucket. On the
     * rare unique-constraint collision on `(merchant_id, reference)` (e.g. a
     * concurrent transaction interleaving on a replica), retries once with a
     * freshly-allocated reference.
     */
    async create(
        document: Omit<BillingDocumentInsert, "reference">
    ): Promise<BillingDocumentSelect> {
        const year = document.documentDate.getUTCFullYear();

        for (
            let attempt = 1;
            attempt <= MAX_REFERENCE_ALLOC_ATTEMPTS;
            attempt++
        ) {
            try {
                return await db.transaction(async (tx) => {
                    const reference = await this.nextReference(
                        document.merchantId,
                        document.kind,
                        year,
                        tx
                    );
                    const [result] = await tx
                        .insert(billingDocumentsTable)
                        .values({ ...document, reference })
                        .returning();
                    if (!result) {
                        throw new Error("Failed to create billing document");
                    }
                    return result;
                });
            } catch (err) {
                const isLastAttempt = attempt === MAX_REFERENCE_ALLOC_ATTEMPTS;
                if (isLastAttempt || !isUniqueReferenceViolation(err)) {
                    throw err;
                }
            }
        }
        // Unreachable (loop always returns or throws) — satisfies the compiler.
        throw new Error("Failed to create billing document");
    }

    /**
     * Stores the generated PDF. Guarded by `isNull(pdfGeneratedAt)` — once a
     * PDF has been issued it is immutable (edits become corrective documents,
     * §3.6); a second call (e.g. a racing regeneration) matches 0 rows and
     * returns null instead of overwriting the original.
     */
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
                    eq(billingDocumentsTable.id, id),
                    isNull(billingDocumentsTable.pdfGeneratedAt)
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
