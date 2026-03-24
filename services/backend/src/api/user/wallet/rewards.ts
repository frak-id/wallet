import { sessionContext } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { Elysia } from "elysia";
import { OrchestrationContext } from "../../../orchestration/context";
import { RewardHistoryResponseSchema } from "../../schemas";

export const rewardsRoutes = new Elysia({ prefix: "/rewards" })
    .use(sessionContext)
    .get(
        "/history",
        async ({ walletSession, query: { limit, offset } }) => {
            return OrchestrationContext.orchestrators.rewardHistory.getHistory(
                walletSession.address,
                {
                    limit: limit ?? 20,
                    offset: offset ?? 0,
                }
            );
        },
        {
            withWalletOrSdkAuthent: true,
            query: t.Object({
                limit: t.Optional(
                    t.Number({ default: 20, minimum: 1, maximum: 100 })
                ),
                offset: t.Optional(t.Number({ default: 0, minimum: 0 })),
            }),
            response: {
                401: t.String(),
                200: RewardHistoryResponseSchema,
            },
        }
    );
