import { RewardHistoryItemSchema } from "@backend-domain/rewards/schemas";
import { t } from "@backend-utils";
import type { Static } from "elysia";

export const RewardHistoryResponseSchema = t.Object({
    items: t.Array(RewardHistoryItemSchema),
    totalCount: t.Number(),
});
export type RewardHistoryResponse = Static<typeof RewardHistoryResponseSchema>;
