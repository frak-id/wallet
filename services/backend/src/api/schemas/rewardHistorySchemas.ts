import { t } from "@backend-utils";
import type { Static } from "elysia";
import {
    AssetStatusSchema,
    InteractionTypeSchema,
    RecipientTypeSchema,
} from "../../domain/rewards/schemas";

export const RewardHistoryItemSchema = t.Object({
    id: t.String(),
    amount: t.Number(),
    tokenAddress: t.Optional(t.String()),
    status: AssetStatusSchema,
    recipientType: RecipientTypeSchema,
    createdAt: t.Date(),
    settledAt: t.Optional(t.Date()),
    onchainTxHash: t.Optional(t.String()),
    trigger: t.Optional(InteractionTypeSchema),
    merchant: t.Object({
        name: t.String(),
        domain: t.String(),
    }),
    token: t.Object({
        symbol: t.String(),
        decimals: t.Number(),
        logo: t.Optional(t.String()),
    }),
});
export type RewardHistoryItem = Static<typeof RewardHistoryItemSchema>;

export const RewardHistoryResponseSchema = t.Object({
    rewards: t.Array(RewardHistoryItemSchema),
});
export type RewardHistoryResponse = Static<typeof RewardHistoryResponseSchema>;
