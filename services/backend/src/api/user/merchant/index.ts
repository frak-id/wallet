import { log, rateLimitMiddleware } from "@backend-infrastructure";
import { t } from "@backend-utils";
import {
    decompressJsonFromB64,
    sanitizeProductDetailsList,
} from "@frak-labs/core-sdk";
import type {
    InteractionTypeKey,
    MerchantReward,
    ProductDetails,
} from "@frak-labs/core-sdk";
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

// `?products=` payload above this many characters is ignored rather than rejected.
//
// Deliberately not a `maxLength` on the query schema: that validates before the handler runs and
// fails the whole request with a 422, so one over-long `products` value would cost the caller its
// `rewards` array too. This is advisory display — the reward still resolves without product
// context, and dropping just the context is strictly better than failing the call.
//
// Both native SDKs cap their own payload at the same number and omit the param rather than send it
// (`MAX_ENCODED_PRODUCTS_LENGTH` / `maxEncodedLength`), so this bound is a backstop for
// hand-rolled callers, not something a shipped client reaches.
const PRODUCTS_PARAM_MAX_LENGTH = 8192;
// Backend-side ceiling on how many products one call can scope against, independent of
// the character budget above — caps the cost of running `matchesProductScope` per
// campaign regardless of how compactly the caller managed to encode more than this.
const PRODUCTS_MAX_ENTRIES = 50;

// Same encoding as `sdk/core`'s `compressJsonToB64`: base64url(utf8(JSON.stringify(...))),
// produced client-side by both native SDKs from their own `ProductDetails`. Never throws:
// a malformed, tampered or oversized payload degrades to "no product context" rather than
// failing the request — this endpoint never 404s today and a `products` typo shouldn't
// start being the exception.
// Exported for direct unit coverage, same convention as
// `validatePackageIdPlatformPairing` below.
export function decodeProductsQueryParam(
    value: string | undefined
): ProductDetails[] | undefined {
    if (!value) return undefined;
    if (value.length > PRODUCTS_PARAM_MAX_LENGTH) {
        log.warn(
            { length: value.length, max: PRODUCTS_PARAM_MAX_LENGTH },
            "[Merchant] estimated-rewards: products param exceeds size budget, ignoring"
        );
        return undefined;
    }

    let decoded: unknown;
    try {
        decoded = decompressJsonFromB64<unknown>(value);
    } catch {
        return undefined;
    }
    if (decoded === null) return undefined;

    const sanitized = sanitizeProductDetailsList(decoded);
    if (!sanitized) return undefined;

    return sanitized.length > PRODUCTS_MAX_ENTRIES
        ? sanitized.slice(0, PRODUCTS_MAX_ENTRIES)
        : sanitized;
}

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
                products,
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
                products: decodeProductsQueryParam(products),
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
                // base64url(utf8(JSON.stringify(ProductDetails[]))) — see
                // `decodeProductsQueryParam` above. `t.String` not `t.Array`: this rides in
                // a GET query string, where a merchant's own reverse proxy or CDN may cap
                // array-style repeated params long before it caps a single string one. No
                // `maxLength` either — length is enforced in the handler so an over-long value
                // costs the product context, not the whole response (see
                // `PRODUCTS_PARAM_MAX_LENGTH`).
                products: t.Optional(t.String()),
            }),
            response: {
                200: EstimatedRewardsResultSchema,
            },
        }
    )
    .use(exploreApi)
    .use(merchantReferralStatusRoute);
