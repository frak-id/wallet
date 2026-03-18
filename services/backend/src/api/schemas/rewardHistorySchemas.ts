import { t } from "@backend-utils";
import type { Static } from "elysia";
import {
    AssetStatusSchema,
    InteractionTypeSchema,
    RecipientTypeSchema,
} from "../../domain/rewards/schemas";

const MerchantInfoSchema = t.Object({
    name: t.String(),
    domain: t.String(),
    heroImageUrl: t.Optional(t.String()),
});

const TokenInfoSchema = t.Object({
    symbol: t.String(),
    decimals: t.Number(),
});

const PurchaseInfoSchema = t.Object({
    amount: t.Number(),
    currency: t.String(),
});

export const RewardHistoryItemSchema = t.Object({
    merchant: MerchantInfoSchema,
    token: TokenInfoSchema,
    amount: t.TokenAmount,
    status: AssetStatusSchema,
    role: RecipientTypeSchema,
    trigger: InteractionTypeSchema,
    txHash: t.Optional(t.String()),
    createdAt: t.Date(),
    settledAt: t.Optional(t.Date()),
    purchase: t.Optional(PurchaseInfoSchema),
});
export type RewardHistoryItem = Static<typeof RewardHistoryItemSchema>;

export const RewardHistoryResponseSchema = t.Object({
    items: t.Array(RewardHistoryItemSchema),
    totalCount: t.Number(),
});
export type RewardHistoryResponse = Static<typeof RewardHistoryResponseSchema>;
