import { db, type PgRunner } from "@backend-infrastructure";
import { isUniqueViolation } from "@backend-utils";
import type { Stablecoin } from "@frak-labs/app-essentials";
import { and, asc, desc, eq, gt, gte, isNull, lt, lte, sql } from "drizzle-orm";
import {
    type BillingDocumentInsert,
    type BillingDocumentSelect,
    billingDocumentsTable,
} from "../db/schema";
import type { BillingDocumentDetails, BillingDocumentKind } from "../schemas";

// Human-facing reference prefix per kind.
const REFERENCE_PREFIX: Record<BillingDocumentKind, string> = {
    deposit: "DEP",
    withdraw: "WDR",
    monthly_bill: "BILL",
};

const MAX_REFERENCE_ALLOC_ATTEMPTS = 2;

/**
 * Formats the human-facing `{PREFIX}-{year}-{NNNN}` reference string (e.g.
 * `DEP-2026-0001`). Pure formatting, split out from `nextReference` so it's
 * unit-testable without a DB.
 */
export function formatReference(
    kind: BillingDocumentKind,
    year: number,
    counter: number
): string {
    return `${REFERENCE_PREFIX[kind]}-${year}-${String(counter).padStart(4, "0")}`;
}

/**
 * All queries are scoped by `merchantId` — never fetch a document by `id`
 * alone (prevents IDOR across merchants).
 */
export class BillingDocumentRepository {
    /**
     * Atomically allocates the next `{PREFIX}-{year}-{NNNN}` reference from the
     * global per-`(kind, year)` sequence via `INSERT ... ON CONFLICT DO UPDATE
     * ... RETURNING` against `billing_document_counters`. The sequence is
     * global (not per-merchant) so Frak's issued numbering stays continuous
     * per issuer for VAT (Art. 242 nonies A — see schema.ts comment). The
     * row-level lock taken by the upsert serializes concurrent allocations —
     * no `SELECT MAX` race.
     *
     * Pass the enclosing `tx` so allocation commits atomically with the
     * document insert (`create` below) — a failed insert after a successful
     * bump would otherwise burn a reference number (gap) but, worse, could
     * hand out the same number to a retried create (duplicate; not acceptable
     * without the transaction).
     */
    async nextReference(
        kind: BillingDocumentKind,
        year: number,
        tx: PgRunner = db
    ): Promise<string> {
        const result = await tx.execute<{ last_value: number }>(sql`
            INSERT INTO billing_document_counters (kind, year, last_value)
            VALUES (${kind}, ${year}, 1)
            ON CONFLICT (kind, year)
            DO UPDATE SET last_value = billing_document_counters.last_value + 1
            RETURNING last_value
        `);
        const row = [...result][0];
        if (!row) {
            throw new Error(
                `Failed to allocate billing reference for kind=${kind} year=${year}`
            );
        }
        return formatReference(kind, year, row.last_value);
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
            from,
            to,
            includeVoided = false,
        }: {
            kind?: BillingDocumentKind;
            from?: Date;
            to?: Date;
            includeVoided?: boolean;
        } = {}
    ): Promise<BillingDocumentSelect[]> {
        return db.query.billingDocumentsTable.findMany({
            where: and(
                eq(billingDocumentsTable.merchantId, merchantId),
                kind ? eq(billingDocumentsTable.kind, kind) : undefined,
                from
                    ? gte(billingDocumentsTable.documentDate, from)
                    : undefined,
                to ? lte(billingDocumentsTable.documentDate, to) : undefined,
                includeVoided
                    ? undefined
                    : isNull(billingDocumentsTable.voidedAt)
            ),
            orderBy: desc(billingDocumentsTable.documentDate),
        });
    }

    /**
     * Allocates the reference and inserts the document atomically (same `tx`).
     * `documentDate`'s UTC year drives the reference counter bucket. On the
     * rare unique-constraint collision on `reference` (e.g. a concurrent
     * transaction interleaving on a replica), retries once with a
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
                if (isLastAttempt || !isUniqueViolation(err)) {
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
     * Clears a monthly bill's cached PDF so the next access regenerates it
     * (used when a voided deposit invalidates a bill that folded it in —
     * §3.6). Resets `pdfStorageKey`/`pdfGeneratedAt` to null, re-opening the
     * write-once `setPdf` guard for a fresh render. Scoped by `merchantId`
     * (IDOR-safe) and to `kind='monthly_bill'` — deposit/withdraw PDFs are
     * immutable and never cleared (their correction path is void + re-emit,
     * not regeneration). This only detaches the row's reference; the caller
     * deletes the stored object AFTER a successful clear (an orphaned object
     * is harmless, a dangling pointer 500s the download route).
     */
    async clearPdf(
        merchantId: string,
        id: string
    ): Promise<BillingDocumentSelect | null> {
        const [result] = await db
            .update(billingDocumentsTable)
            .set({
                pdfStorageKey: null,
                pdfGeneratedAt: null,
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(billingDocumentsTable.merchantId, merchantId),
                    eq(billingDocumentsTable.id, id),
                    eq(billingDocumentsTable.kind, "monthly_bill")
                )
            )
            .returning();
        return result ?? null;
    }

    /**
     * Overwrites a monthly bill's `details` (recomputed ledger/annex)
     * during PDF regeneration — the row exists but its stored breakdown must
     * be refreshed from current data before re-rendering (§6.3). Guarded to
     * non-voided `monthly_bill` rows without a PDF: an already-issued PDF is
     * write-once (`isNull(pdfGeneratedAt)`), so this can't mutate a sealed
     * bill's frozen totals — only a bill awaiting (re)generation.
     */
    async updateMonthlyBillDetails(
        merchantId: string,
        id: string,
        details: BillingDocumentDetails,
        amounts?: { grossAmount: string; netAmount: string }
    ): Promise<BillingDocumentSelect | null> {
        const [result] = await db
            .update(billingDocumentsTable)
            .set({ details, ...amounts, updatedAt: new Date() })
            .where(
                and(
                    eq(billingDocumentsTable.merchantId, merchantId),
                    eq(billingDocumentsTable.id, id),
                    eq(billingDocumentsTable.kind, "monthly_bill"),
                    isNull(billingDocumentsTable.voidedAt),
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

    /**
     * Non-voided withdraws that link a given deposit — the deposit's
     * dependents, voided alongside it (§3.6, see
     * `BillingOrchestrator.cascadeDepositVoid`). Scoped by `merchantId`
     * (IDOR-safe).
     */
    async findWithdrawsByLinkedDeposit(
        merchantId: string,
        depositId: string
    ): Promise<BillingDocumentSelect[]> {
        return db.query.billingDocumentsTable.findMany({
            where: and(
                eq(billingDocumentsTable.merchantId, merchantId),
                eq(billingDocumentsTable.kind, "withdraw"),
                eq(billingDocumentsTable.linkedDepositId, depositId),
                isNull(billingDocumentsTable.voidedAt)
            ),
        });
    }

    /**
     * Non-voided monthly bills whose period covers or postdates `documentDate`
     * — i.e. bills whose derived ledger folded in (or would have folded in) a
     * deposit dated `documentDate`, and are therefore stale once that deposit
     * is voided (§6.2/§3.6). A bill's ledger sums all deposits/withdraws with
     * `documentDate < periodEnd`, so any bill with `periodEnd > documentDate`
     * is affected. Scoped by `merchantId` (IDOR-safe).
     */
    async findMonthlyBillsCovering(
        merchantId: string,
        documentDate: Date
    ): Promise<BillingDocumentSelect[]> {
        return db.query.billingDocumentsTable.findMany({
            where: and(
                eq(billingDocumentsTable.merchantId, merchantId),
                eq(billingDocumentsTable.kind, "monthly_bill"),
                gt(billingDocumentsTable.periodEnd, documentDate),
                isNull(billingDocumentsTable.voidedAt)
            ),
        });
    }

    /**
     * Distinct non-voided deposit/withdraw currencies for a merchant — one
     * half of the monthly-bill ledger currency set (the other half is
     * stablecoins seen in settled rewards; see `MonthlyBillOrchestrator`).
     */
    async distinctCurrencies(merchantId: string): Promise<Stablecoin[]> {
        const rows = await db
            .selectDistinct({ currency: billingDocumentsTable.currency })
            .from(billingDocumentsTable)
            .where(
                and(
                    eq(billingDocumentsTable.merchantId, merchantId),
                    isNull(billingDocumentsTable.voidedAt),
                    sql`${billingDocumentsTable.kind} IN ('deposit', 'withdraw')`
                )
            )
            // Deterministic order — SELECT DISTINCT without ORDER BY is
            // plan-dependent, and callers use the FIRST currency as the
            // monthly bill's primary/invoice currency; a plan change must
            // never flip which currency a bill is labeled in.
            .orderBy(asc(billingDocumentsTable.currency));
        return rows.map((row) => row.currency);
    }

    /**
     * Deposit/withdraw totals grouped by currency, either "before" a single
     * instant (ledger opening/closing balance) or within a half-open
     * `[start, end)` window (in-period movement) — monthly-bill fiat ledger
     * Both legs sum the `net_amount` column:
     * for deposits it is the net-to-bank amount, and `createWithdraw` stores
     * `net_amount = bankSent` for withdraws (the total sent to the
     * destination account), so no jsonb extraction is needed. Voided
     * documents are excluded. Returns decimal strings; callers must use
     * decimal.js, never parseFloat.
     */
    async aggregateDepositWithdrawByCurrency(
        merchantId: string,
        opts: { before: Date } | { start: Date; end: Date }
    ): Promise<
        Array<{ currency: Stablecoin; deposited: string; withdrawn: string }>
    > {
        const dateCondition =
            "before" in opts
                ? lt(billingDocumentsTable.documentDate, opts.before)
                : and(
                      gte(billingDocumentsTable.documentDate, opts.start),
                      lt(billingDocumentsTable.documentDate, opts.end)
                  );

        const rows = await db
            .select({
                currency: billingDocumentsTable.currency,
                deposited:
                    sql<string>`COALESCE(SUM(${billingDocumentsTable.netAmount}) FILTER (WHERE ${billingDocumentsTable.kind} = 'deposit'), 0)`.mapWith(
                        String
                    ),
                withdrawn:
                    sql<string>`COALESCE(SUM(${billingDocumentsTable.netAmount}) FILTER (WHERE ${billingDocumentsTable.kind} = 'withdraw'), 0)`.mapWith(
                        String
                    ),
            })
            .from(billingDocumentsTable)
            .where(
                and(
                    eq(billingDocumentsTable.merchantId, merchantId),
                    isNull(billingDocumentsTable.voidedAt),
                    sql`${billingDocumentsTable.kind} IN ('deposit', 'withdraw')`,
                    dateCondition
                )
            )
            .groupBy(billingDocumentsTable.currency);

        return rows;
    }

    /**
     * The `documentDate` of a merchant's oldest non-voided deposit, or null if
     * the merchant has never had one. Drives the monthly-bill backfill's lower
     * bound (the cron generates bills from the oldest of merchant-creation /
     * first-deposit up to the current month) and doubles as the
     * "has any deposit" gate that skips merchants with nothing to bill.
     */
    async findOldestDepositDate(merchantId: string): Promise<Date | null> {
        const row = await db.query.billingDocumentsTable.findFirst({
            where: and(
                eq(billingDocumentsTable.merchantId, merchantId),
                eq(billingDocumentsTable.kind, "deposit"),
                isNull(billingDocumentsTable.voidedAt)
            ),
            orderBy: asc(billingDocumentsTable.documentDate),
            columns: { documentDate: true },
        });
        return row?.documentDate ?? null;
    }

    /**
     * `periodStart`s of all non-voided monthly bills for a merchant — the
     * backfill loads these once and skips months already covered, avoiding a
     * per-month existence probe on every cron run.
     */
    async listMonthlyBillPeriodStarts(merchantId: string): Promise<Date[]> {
        const rows = await db.query.billingDocumentsTable.findMany({
            where: and(
                eq(billingDocumentsTable.merchantId, merchantId),
                eq(billingDocumentsTable.kind, "monthly_bill"),
                isNull(billingDocumentsTable.voidedAt)
            ),
            columns: { periodStart: true },
        });
        return rows
            .map((row) => row.periodStart)
            .filter((d): d is Date => d !== null);
    }

    /**
     * Looks up an existing (non-voided) monthly bill for a merchant+period —
     * used to return the existing document on a duplicate-generation attempt
     * (409, idempotency guarded by the DB team's partial-unique
     * `(merchant_id, period_start) WHERE kind='monthly_bill'`, §6.4).
     */
    async findMonthlyBillByPeriod(
        merchantId: string,
        periodStart: Date
    ): Promise<BillingDocumentSelect | null> {
        const result = await db.query.billingDocumentsTable.findFirst({
            where: and(
                eq(billingDocumentsTable.merchantId, merchantId),
                eq(billingDocumentsTable.kind, "monthly_bill"),
                eq(billingDocumentsTable.periodStart, periodStart),
                isNull(billingDocumentsTable.voidedAt)
            ),
        });
        return result ?? null;
    }
}
