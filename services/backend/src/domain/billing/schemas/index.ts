import { t } from "@backend-utils";
import type { Static } from "elysia";

export const BillingDocumentKindSchema = t.Union([
    t.Literal("deposit"),
    t.Literal("withdraw"),
    t.Literal("monthly_bill"),
]);
export type BillingDocumentKind = Static<typeof BillingDocumentKindSchema>;

export const StablecoinSchema = t.Union([
    t.Literal("eure"),
    t.Literal("gbpe"),
    t.Literal("usde"),
    t.Literal("usdc"),
]);

/**
 * `details` jsonb shape, explicitly typed per `kind`. VAT/fee breakdown
 * and free-text notes live here (frozen at issue
 * time) rather than as table columns.
 */
const DepositDetailsSchema = t.Object({
    kind: t.Literal("deposit"),
    vatAmount: t.String(), // decimal string; "0" when country !== FR
    frakFeeAmount: t.String(),
    // Offered/gifted top-up added back to the net (§4). Optional: absent on
    // pre-existing deposit rows, treated as "0" by readers.
    giftedAmount: t.Optional(t.String()),
    paymentPlatform: t.Optional(
        t.Union([t.Literal("shopify"), t.Literal("stripe")])
    ),
    note: t.Optional(t.String({ maxLength: 2000 })),
});

const WithdrawDetailsSchema = t.Object({
    kind: t.Literal("withdraw"),
    remainingBankAmount: t.String(),
    distributedRatio: t.String(), // "0".."1"
    restitutedVat: t.String(),
    restitutedFrakFee: t.String(),
    bankSent: t.String(),
    // e.g. "FR76 **** **** **** 123" (country + IBAN check digits kept,
    // middle masked) — never a full IBAN (§3.5).
    maskedIban: t.String({ maxLength: 64 }),
    note: t.Optional(t.String({ maxLength: 2000 })),
});

const MonthlyBillLedgerSchema = t.Object({
    currency: StablecoinSchema,
    openingBalance: t.String(),
    closingBalance: t.String(),
    totalDeposited: t.String(),
    totalWithdrawn: t.String(),
    totalRewarded: t.String(),
});

const MonthlyBillDetailsSchema = t.Object({
    kind: t.Literal("monthly_bill"),
    ledgers: t.Array(MonthlyBillLedgerSchema),
    annexRowCount: t.Number(),
    fiatTotals: t.Object({
        eur: t.String(),
        usd: t.String(),
        gbp: t.String(),
    }),
});

export const BillingDocumentDetailsSchema = t.Union([
    DepositDetailsSchema,
    WithdrawDetailsSchema,
    MonthlyBillDetailsSchema,
]);
export type BillingDocumentDetails = Static<
    typeof BillingDocumentDetailsSchema
>;
export type MonthlyBillDetails = Static<typeof MonthlyBillDetailsSchema>;

/**
 * Shared API response contract for a `billing_documents` row — used by both
 * the admin CRUD routes and the merchant-facing read routes so the two
 * surfaces never drift. Deliberately excludes `details` (VAT/fee/ledger
 * breakdown, masked IBAN) — that's frozen into the PDF; the API only
 * exposes the column-level summary.
 */
export const BillingDocumentResponseSchema = t.Object({
    id: t.String(),
    merchantId: t.String(),
    kind: BillingDocumentKindSchema,
    reference: t.String(),
    documentDate: t.String(),
    periodStart: t.Union([t.String(), t.Null()]),
    periodEnd: t.Union([t.String(), t.Null()]),
    currency: StablecoinSchema,
    grossAmount: t.Union([t.String(), t.Null()]),
    netAmount: t.Union([t.String(), t.Null()]),
    txHash: t.Union([t.Hex(), t.Null()]),
    linkedDepositId: t.Union([t.String(), t.Null()]),
    pdfGeneratedAt: t.Union([t.String(), t.Null()]),
    voidedAt: t.Union([t.String(), t.Null()]),
    createdAt: t.Union([t.String(), t.Null()]),
});
export type BillingDocumentResponse = Static<
    typeof BillingDocumentResponseSchema
>;

// `toBillingDocumentResponse` (row -> response mapper) lives in
// `./toResponse` to avoid importing `../db/schema` here, which would create a
// cycle (db/schema types its columns from these schema types).
