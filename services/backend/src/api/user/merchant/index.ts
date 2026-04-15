import { Elysia, status, t } from "elysia";
import { CampaignContext } from "../../../domain/campaign/context";
import { EstimatedRewardsResultSchema } from "../../../domain/campaign/schemas";
import { MerchantContext } from "../../../domain/merchant/context";
import { MerchantResolveResponseSchema } from "../../schemas";
import { exploreApi } from "./explorer";
import { merchantReferralStatusRoute } from "./referralStatus";

function normalizeDomain(domain: string): string {
    return domain
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/:\d+$/, "")
        .replace(/\/$/, "")
        .replace(/^www\./, "");
}

export const userMerchantApi = new Elysia({ prefix: "/merchant" })
    .get(
        "/resolve",
        async ({ query: { domain, merchantId, lang } }) => {
            const result = await MerchantContext.services.resolve.resolve({
                id: merchantId,
                domain: domain ? normalizeDomain(domain) : undefined,
                lang,
            });

            if (!result) {
                return status(404, "Merchant not found");
            }

            return result;
        },
        {
            query: t.Object({
                domain: t.Optional(t.String({ minLength: 1 })),
                merchantId: t.Optional(t.String({ format: "uuid" })),
                lang: t.Optional(t.String()),
            }),
            response: {
                200: MerchantResolveResponseSchema,
                404: t.String(),
            },
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
    )
    .use(exploreApi)
    .use(merchantReferralStatusRoute);
