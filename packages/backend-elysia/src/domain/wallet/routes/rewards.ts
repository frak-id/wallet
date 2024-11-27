import {
    blockchainContext,
    indexerApiContext,
    walletSessionContext,
} from "@backend-common";
import { t } from "@backend-utils";
import { Elysia } from "elysia";
import { PricingRepository } from "../repositories/PricingRepository";

export const rewardsRoutes = new Elysia({ prefix: "/reward" })
    .use(walletSessionContext)
    .use(indexerApiContext)
    .use(blockchainContext)
    .decorate(({ client, ...decorators }) => ({
        ...decorators,
        pricingRepository: new PricingRepository(),
        client,
    }))
    .get(
        "estimated",
        async ({ query: { productId }, error, client, walletSession }) => {
            if (!walletSession) return error(401, "Unauthorized");

            // Get all the linked campaign on this product
            // const linkedCampaign = await readContract(client, {
            //     abi: productInteractionManagerAbi,
            // });

            return {
                cumulated: {
                    eur: 0,
                    raw: 0n,
                },
                rewards: [],
            };
        },
        {
            authenticated: "wallet",
            query: t.Object({
                productId: t.Hex(),
            }),
            response: {
                401: t.String(),
                200: t.Object({
                    cumulated: t.Object({
                        eur: t.Number(),
                        raw: t.BigInt(),
                    }),
                    rewards: t.Array(
                        t.Object({
                            campaign: t.Address(),
                            trigger: t.String(),
                            eur: t.Number(),
                            raw: t.BigInt(),
                        })
                    ),
                }),
            },
        }
    );
