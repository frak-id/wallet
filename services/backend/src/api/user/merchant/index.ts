import { rateLimitMiddleware } from "@backend-infrastructure";
import { t } from "@backend-utils";
import type { InteractionTypeKey, MerchantReward } from "@frak-labs/core-sdk";
import { selectBestReward } from "@frak-labs/core-sdk/rewards";
import { Elysia, status } from "elysia";
import { CampaignContext } from "../../../domain/campaign/context";
import { EstimatedRewardsResultSchema } from "../../../domain/campaign/schemas";
import { MerchantContext } from "../../../domain/merchant/context";
import { PlatformSchema } from "../../../domain/merchant/schemas";
import { MerchantResolveResponseSchema } from "../../schemas";
import { exploreApi } from "./explorer";
import { merchantReferralStatusRoute } from "./referralStatus";

const CurrencySchema = t.Union([
    t.Literal("eur"),
    t.Literal("usd"),
    t.Literal("gbp"),
]);
const AudienceSchema = t.Union([t.Literal("referrer"), t.Literal("referee")]);

// `t.Object` can't express "required only when packageId is set".
export function validatePackageIdPlatformPairing(query: {
    packageId?: string;
    platform?: string;
}): string | undefined {
    if (query.packageId && !query.platform) {
        return "platform is required when packageId is set";
    }
    return undefined;
}

export const userMerchantApi = new Elysia({ prefix: "/merchant" })
    // `maxRequests` must stay distinct across every limiter in this tree
    // (`exploreApi` uses 30): Elysia dedups plugins by name+seed, so identical
    // configs collapse into a single shared bucket.
    .use(rateLimitMiddleware({ windowMs: 60_000, maxRequests: 60 }))
    .get(
        "/resolve",
        async ({
            query: { domain, merchantId, lang, packageId, platform },
        }) => {
            const pairingError = validatePackageIdPlatformPairing({
                packageId,
                platform,
            });
            if (pairingError) {
                return status(400, {
                    success: false,
                    error: pairingError,
                    code: "INVALID_PACKAGE_ID_PAIRING",
                });
            }

            const result = await MerchantContext.services.resolve.resolve({
                id: merchantId,
                domain: domain
                    ? MerchantContext.repositories.dnsCheck.getNormalizedDomain(
                          domain
                      )
                    : undefined,
                packageId,
                platform,
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
                packageId: t.Optional(t.String({ minLength: 1 })),
                platform: t.Optional(PlatformSchema),
            }),
            response: {
                200: MerchantResolveResponseSchema,
                400: t.ErrorResponse,
                404: t.String(),
            },
        }
    )
    .use(rateLimitMiddleware({ windowMs: 60_000, maxRequests: 90 }))
    .get(
        "/estimated-rewards",
        async ({
            query: {
                merchantId,
                formatted,
                currency,
                targetInteraction,
                audience,
            },
        }) => {
            const result =
                await CampaignContext.services.estimatedReward.getEstimatedRewards(
                    merchantId
                );

            if (formatted !== "1") {
                return result;
            }

            // Casts because `interactionTypeKey` is an open string here and a
            // closed union in the SDK. Unchecked is fine: the SDK only compares
            // it by equality, so an unknown value simply never matches.
            const best = selectBestReward(result.rewards as MerchantReward[], {
                currency,
                targetInteraction: targetInteraction as InteractionTypeKey,
                audience,
            });

            return { ...result, ...(best && { best }) };
        },
        {
            query: t.Object({
                merchantId: t.String({ format: "uuid" }),
                // Not `t.Boolean()`, which only coerces "true"/"false".
                formatted: t.Optional(t.Literal("1")),
                currency: t.Optional(CurrencySchema),
                targetInteraction: t.Optional(t.String()),
                audience: t.Optional(AudienceSchema),
            }),
            response: {
                200: EstimatedRewardsResultSchema,
            },
        }
    )
    .use(exploreApi)
    .use(merchantReferralStatusRoute);
