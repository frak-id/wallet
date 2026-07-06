import { t } from "@backend-utils";
import type { Static } from "elysia";

export const BillingDocumentKindSchema = t.Union([
    t.Literal("deposit"),
    t.Literal("withdraw"),
    t.Literal("monthly_bill"),
]);
export type BillingDocumentKind = Static<typeof BillingDocumentKindSchema>;

const StablecoinSchema = t.Union([
    t.Literal("eure"),
    t.Literal("gbpe"),
    t.Literal("usde"),
    t.Literal("usdc"),
]);

/**
 * `details` jsonb shape, explicitly typed per `kind` (billing-feature-plan.md
 * §3.2). VAT/fee breakdown and free-text notes live here (frozen at issue
 * time) rather than as table columns.
 */
const DepositDetailsSchema = t.Object({
    kind: t.Literal("deposit"),
    vatAmount: t.String(), // decimal string; "0" when country !== FR
    frakFeeAmount: t.String(),
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
    // e.g. "FR76 **** **** **** 123" — never a full IBAN (§3.5).
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
    // On-chain divergence check, frozen at generation time (never recomputed
    // on re-download — §6.3). Optional: absent on documents generated before
    // this field existed, or when never checked. `skipped` covers a null
    // `bankAddress` or a failed on-chain read — the bill still publishes
    // (best-effort mitigation, §6.2), it's just not verified.
    review: t.Optional(
        t.Object({
            flagged: t.Boolean(),
            checkedAt: t.String(),
            perCurrency: t.Array(
                t.Object({
                    currency: StablecoinSchema,
                    derivedClosing: t.String(),
                    onChainBalance: t.String(),
                    deltaAbs: t.String(),
                    withinThreshold: t.Boolean(),
                })
            ),
            skipped: t.Optional(t.Boolean()),
            skipReason: t.Optional(t.String()),
        })
    ),
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
export type MonthlyBillReview = NonNullable<MonthlyBillDetails["review"]>;
