import { Elysia, status, t } from "elysia";
import { keccak256, toHex } from "viem";
import { CampaignContext } from "../../../domain/campaign/context";
import { EstimatedRewardsResultSchema } from "../../../domain/campaign/schemas";
import { MerchantContext } from "../../../domain/merchant/context";

export const userMerchantApi = new Elysia({ prefix: "/merchant" })
    .get(
        "/resolve",
        async ({ query: { domain } }) => {
            const normalizedDomain = domain
                .toLowerCase()
                .replace(/^https?:\/\//, "")
                .replace(/:\d+$/, "")
                .replace(/\/$/, "")
                .replace(/^www\./, "");

            const merchant =
                await MerchantContext.repositories.merchant.findByDomain(
                    normalizedDomain
                );

            if (!merchant) {
                return status(404, { error: "Merchant not found" });
            }

            const productId =
                merchant.productId ?? keccak256(toHex(normalizedDomain));

            return {
                merchantId: merchant.id,
                productId,
                name: merchant.name,
                domain: merchant.domain,
            };
        },
        {
            query: t.Object({
                domain: t.String({ minLength: 1 }),
            }),
        }
    )
    .get(
        "/estimated-rewards",
        async ({ query: { merchantId } }) => {
            return CampaignContext.services.estimatedReward.getEstimatedRewards(
                merchantId
            );
        },
        {
            query: t.Object({
                merchantId: t.String({ format: "uuid" }),
            }),
            response: {
                200: EstimatedRewardsResultSchema,
            },
        }
    );
