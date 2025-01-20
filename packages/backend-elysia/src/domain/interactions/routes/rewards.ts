import { indexerApiContext } from "@backend-common";
import { t } from "@backend-utils";
import { Elysia } from "elysia";
import { interactionsContext } from "../context";
import { CampaignDataRepository } from "../repositories/CampaignDataRepository";
import { CampaignRewardsService } from "../services/CampaignRewardsService";

export const rewardsRoutes = new Elysia({ prefix: "/reward" })
    .use(interactionsContext)
    .use(indexerApiContext)
    // Some repo and services to our context
    .decorate(({ client, indexerApi, pricingRepository, ...decorators }) => {
        const campaignDataRepository = new CampaignDataRepository(client);
        const campaignRewardsService = new CampaignRewardsService(
            client,
            indexerApi,
            pricingRepository,
            campaignDataRepository
        );

        return {
            ...decorators,
            client,
            indexerApi,
            pricingRepository,
            campaignDataRepository,
            campaignRewardsService,
        };
    })
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

            // Get the max amount that can be distributed for the referrer and the referee
            const maxReferrerEurAmount = filteredRewards.reduce(
                (acc, reward) =>
                    reward.referrer.eurAmount > acc
                        ? reward.referrer.eurAmount
                        : acc,
                0
            );
            const maxRefereeAmount = filteredRewards.reduce(
                (acc, reward) =>
                    reward.referee.eurAmount > acc
                        ? reward.referee.eurAmount
                        : acc,
                0
            );

            return {
                totalReferrerEur: maxReferrerEurAmount,
                totalRefereeEur: maxRefereeAmount,
                activeRewards: filteredRewards,
            };
        },
        {
            query: t.Object({
                productId: t.Hex(),
                interactionKey: t.Optional(t.String()),
            }),
            response: t.Union([
                t.Object({
                    totalReferrerEur: t.Number(),
                    totalRefereeEur: t.Number(),
                    activeRewards: t.Array(
                        t.Object({
                            campaign: t.Address(),
                            interactionTypeKey: t.String(),
                            token: t.Address(),
                            referrer: t.Object({
                                amount: t.Number(),
                                eurAmount: t.Number(),
                                usdAmount: t.Number(),
                            }),
                            referee: t.Object({
                                amount: t.Number(),
                                eurAmount: t.Number(),
                                usdAmount: t.Number(),
                            }),
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
                }),
                t.Null(),
            ]),
        }
    );
