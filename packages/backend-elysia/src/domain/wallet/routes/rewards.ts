import { walletSessionContext } from "@backend-common";
import { t } from "@backend-utils";
import { Elysia } from "elysia";
import { walletContext } from "../context";

export const rewardsRoutes = new Elysia({ prefix: "/reward" })
    .use(walletSessionContext)
    .use(walletContext)
    .get(
        "estimate",
        async ({ query: { productId }, campaignRewardsService }) => {
            const estimation = await campaignRewardsService.getRewardForProduct(
                { productId }
            );
            return estimation ?? null;
        },
        {
            authenticated: "wallet",
            query: t.Object({
                productId: t.Hex(),
            }),
            response: t.Union([
                t.Object({
                    totalPerCampaign: t.Number(),
                    avgPerCampaign: t.Number(),
                    activeRewards: t.Array(
                        t.Object({
                            campaign: t.Address(),
                            interactionTypeKey: t.String(),
                            token: t.Address(),
                            amount: t.Number(),
                            eurAmount: t.Number(),
                            rawAmount: t.Hex(),
                        })
                    ),
                }),
                t.Null(),
            ]),
        }
    );
