import { indexerApiContext } from "@backend-common";
import { t } from "@backend-utils";
import { Elysia } from "elysia";
import type { Address } from "viem";
import { interactionsContext } from "../context";
import { CampaignDataRepository } from "../repositories/CampaignDataRepository";
import {
    type ActiveReward,
    CampaignRewardsService,
} from "../services/CampaignRewardsService";

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

            // Group per campaign
            const groupedRewards = filteredRewards.reduce(
                (acc, reward) => {
                    if (!acc[reward.campaign]) {
                        acc[reward.campaign] = [];
                    }
                    if (reward.amount > 0) {
                        acc[reward.campaign].push(reward);
                    }
                    return acc;
                },
                {} as Record<Address, ActiveReward[]>
            );

            // Calculate the total per campaign
            const totalEur = Object.values(groupedRewards).reduce(
                (acc, rewards) => {
                    if (!rewards.length) {
                        return acc;
                    }

                    const average =
                        rewards.reduce(
                            (acc, reward) => acc + reward.eurAmount,
                            0
                        ) / rewards.length;
                    return acc + average;
                },
                0
            );

            return {
                totalReferrerEur: totalEur / 2,
                totalRefereeEur: totalEur / 2,
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
                            amount: t.Number(),
                            eurAmount: t.Number(),
                            usdAmount: t.Number(),
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
