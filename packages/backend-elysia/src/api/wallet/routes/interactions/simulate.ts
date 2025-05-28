import { t } from "@backend-utils";
import { Elysia } from "elysia";
import { interactionsContext } from "../../../../domain/interactions";

const emptyTokenAmount = {
    amount: 0,
    eurAmount: 0,
    usdAmount: 0,
    gbpAmount: 0,
};

export const simulateRoutes = new Elysia()
    .use(interactionsContext)
    // Estimate potential reward for an interaction
    .get(
        "/estimate",
        async ({
            query: { productId, interactionKey },
            campaignRewardsService,
        }) => {
            // Get all the active rewards
            const activeRewards =
                await campaignRewardsService.getActiveRewardsForProduct({
                    productId,
                });
            if (!activeRewards) return null;

            // Filter on a specific interaction key
            const filteredRewards = interactionKey
                ? activeRewards?.filter(
                      (reward) => reward.interactionTypeKey === interactionKey
                  )
                : activeRewards;
            if (!filteredRewards.length) return null;

            // Get the total for both referrer and referee
            const maxReferrer = filteredRewards.reduce(
                (acc, reward) =>
                    reward.referrer.amount > acc.amount ? reward.referrer : acc,
                emptyTokenAmount
            );
            const maxReferee = filteredRewards.reduce(
                (acc, reward) =>
                    reward.referee.amount > acc.amount ? reward.referee : acc,
                emptyTokenAmount
            );

            return {
                maxReferee,
                maxReferrer,
                activeRewards: filteredRewards,
                // to be deleted once everything is up to date
                totalReferrerEur: maxReferrer.eurAmount,
                totalRefereeEur: maxReferee.eurAmount,
            };
        },
        {
            query: t.Object({
                productId: t.Hex(),
                interactionKey: t.Optional(t.String()),
            }),
            response: t.Union([
                t.Object({
                    // Total for both referrer and referee
                    maxReferrer: t.TokenAmount,
                    maxReferee: t.TokenAmount,
                    // Array of all the activate rewards
                    activeRewards: t.Array(
                        t.Object({
                            campaign: t.Address(),
                            interactionTypeKey: t.String(),
                            token: t.Address(),
                            referrer: t.TokenAmount,
                            referee: t.TokenAmount,
                            triggerData: t.Union([
                                t.Object({
                                    baseReward: t.Number(),
                                }),
                                t.Object({
                                    startReward: t.Number(),
                                    endReward: t.Number(),
                                    beta: t.Number(),
                                }),
                            ]),
                        })
                    ),
                    // @deprecated: for legacy purposes, should use the `maxReferee` o `maxReferrer` fields
                    totalReferrerEur: t.Number(),
                    totalRefereeEur: t.Number(),
                }),
                t.Null(),
            ]),
        }
    );
