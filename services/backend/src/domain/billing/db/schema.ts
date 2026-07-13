import type { Stablecoin } from "@frak-labs/app-essentials";
import {
    index,
    integer,
    jsonb,
    numeric,
    pgTable,
    primaryKey,
    text,
    timestamp,
    unique,
    uuid,
} from "drizzle-orm/pg-core";
import type { Hex } from "viem";
import { customHex } from "../../../utils/drizzle/customTypes";
import type { BillingDocumentDetails, BillingDocumentKind } from "../schemas";

/**
 * Discriminated billing document — covers deposit notes, withdraw bills and
 * monthly bills (see billing-feature-plan.md §3.2). VAT/fee breakdown is not
 * columnized: it is frozen into `details` at issue time, keyed by `kind`.
 *
 * Money columns use numeric(36,18) to match `asset_logs` token precision.
 * Drizzle returns these as strings — money arithmetic must use decimal.js,
 * never parseFloat (see §4).
 *
 * The following are DB-team-owned migration concerns (see AGENTS.md) — they
 * cannot be expressed in Drizzle here and MUST be added in the hand-written
 * migration:
 *   - FK  merchant_id       -> merchants.id
 *   - FK  linked_deposit_id -> billing_documents.id  (self-referential; required
 *         for withdraw restitution math — §4)
 *   - Partial unique  (merchant_id, period_start) WHERE kind = 'monthly_bill'
 *         (idempotent monthly-bill generation — §6.4)
 *   - Per-(kind, year) SEQUENCE backing the reference counter (§3.2)
 *   - CHECK  kind     IN ('deposit','withdraw','monthly_bill')
 *   - CHECK  currency IN ('eure','gbpe','usde','usdc')
 *   - CHECK  kind NOT IN ('deposit','withdraw')
 *            OR (gross_amount IS NOT NULL AND net_amount IS NOT NULL)
 *         (deposit/withdraw rows must carry amounts the fiat ledger sums — §6.2)
 *   - CHECK  kind != 'withdraw' OR linked_deposit_id IS NOT NULL
 *   - Partial index on (merchant_id, kind) WHERE voided_at IS NULL
 *         (hot path for the ledger aggregation — §6.2)
 */
export const billingDocumentsTable = pgTable(
    "billing_documents",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        merchantId: uuid("merchant_id").notNull(),
        kind: text("kind").$type<BillingDocumentKind>().notNull(),

        // Human-facing reference (DEP-/WDR-/BILL- + year + counter). Unique per merchant.
        reference: text("reference").notNull(),

        // Event / period
        documentDate: timestamp("document_date").notNull(),
        periodStart: timestamp("period_start"), // monthly_bill only
        periodEnd: timestamp("period_end"), // monthly_bill only

        // Stablecoin the campaign bank holds (eure/gbpe/usde/usdc).
        currency: text("currency").$type<Stablecoin>().notNull(),

        // Amount deposited/withdrawn (gross) and what reaches/leaves the bank (net).
        grossAmount: numeric("gross_amount", { precision: 36, scale: 18 }),
        netAmount: numeric("net_amount", { precision: 36, scale: 18 }),

        // On-chain / banking proof
        txHash: customHex("tx_hash").$type<Hex>(),

        // Withdraw -> the deposit it reverses (restitution source). Self-FK.
        linkedDepositId: uuid("linked_deposit_id"),

        details: jsonb("details").$type<BillingDocumentDetails>(),

        // Stored PDF (S3/RustFS). Null until generated.
        pdfStorageKey: text("pdf_storage_key"),
        pdfGeneratedAt: timestamp("pdf_generated_at"),

        // Author + soft delete (10-year financial retention — §3.6).
        // Business account id of the acting admin (null for cron-generated
        // monthly bills / legacy sessions with no account row).
        createdBy: uuid("created_by"),
        voidedAt: timestamp("voided_at"),

        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => [
        index("billing_documents_merchant_idx").on(table.merchantId),
        index("billing_documents_merchant_kind_idx").on(
            table.merchantId,
            table.kind
        ),
        unique("billing_documents_merchant_reference_uq").on(
            table.merchantId,
            table.reference
        ),
    ]
);

export type BillingDocumentInsert = typeof billingDocumentsTable.$inferInsert;
export type BillingDocumentSelect = typeof billingDocumentsTable.$inferSelect;

/**
 * Backs per-merchant, per-kind, per-year reference counters (e.g.
 * `DEP-2026-0001`). A dedicated table — not a Postgres `SEQUENCE` — because
 * sequences can't reset per `(merchant, kind, year)` without runtime DDL
 * (rejected: agents/app never own migrations, see AGENTS.md). Allocation is
 * a single atomic `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` against
 * this table (see `BillingDocumentRepository.nextReference`), which
 * serializes concurrent creates via the row lock — no `SELECT MAX` race.
 *
 * DB-team migration must add:
 *   CREATE TABLE billing_document_counters (
 *       merchant_id  uuid    NOT NULL,
 *       kind         text    NOT NULL,
 *       year         integer NOT NULL,
 *       last_value   integer NOT NULL DEFAULT 0,
 *       PRIMARY KEY (merchant_id, kind, year)
 *   );
 *   -- FK merchant_id -> merchants.id
 */
export const billingDocumentCountersTable = pgTable(
    "billing_document_counters",
    {
        merchantId: uuid("merchant_id").notNull(),
        kind: text("kind").$type<BillingDocumentKind>().notNull(),
        year: integer("year").notNull(),
        lastValue: integer("last_value").notNull().default(0),
    },
    (table) => [
        primaryKey({
            columns: [table.merchantId, table.kind, table.year],
        }),
    ]
);

export type BillingDocumentCounterInsert =
    typeof billingDocumentCountersTable.$inferInsert;
export type BillingDocumentCounterSelect =
    typeof billingDocumentCountersTable.$inferSelect;
