import type { Language } from "@frak-labs/core-sdk";
import { Elysia, status, t } from "elysia";
import { keccak256, toHex } from "viem";
import { CampaignContext } from "../../../domain/campaign/context";
import { EstimatedRewardsResultSchema } from "../../../domain/campaign/schemas";
import { MerchantContext } from "../../../domain/merchant/context";
import type { SdkConfig } from "../../../domain/merchant/schemas";
import {
    MerchantResolveResponseSchema,
    type ResolvedPlacement,
    type ResolvedSdkConfig,
} from "../../schemas";
import { exploreApi } from "./explorer";

function resolveLanguage(
    sdkConfig: SdkConfig | null | undefined,
    queryLang: string | undefined
): Language {
    if (sdkConfig?.lang) return sdkConfig.lang;
    if (queryLang === "fr" || queryLang === "en") return queryLang;
    return "en";
}

function mergeTranslations(
    defaultTranslations: Record<string, string> | undefined,
    langTranslations: Record<string, string> | undefined
): Record<string, string> | undefined {
    if (!defaultTranslations && !langTranslations) return undefined;
    return { ...defaultTranslations, ...langTranslations };
}

function buildResolvedPlacements(
    placements: SdkConfig["placements"],
    lang: Language
): Record<string, ResolvedPlacement> | undefined {
    if (!placements) return undefined;

    const resolvedPlacements: Record<string, ResolvedPlacement> = {};
    for (const [id, placement] of Object.entries(placements)) {
        const placementTranslations = mergeTranslations(
            placement.translations?.default,
            placement.translations?.[lang]
        );

        resolvedPlacements[id] = {
            ...(placement.components && {
                components: placement.components,
            }),
            ...(placement.targetInteraction && {
                targetInteraction: placement.targetInteraction,
            }),
            ...(placementTranslations && {
                translations: placementTranslations,
            }),
            ...(placement.css && { css: placement.css }),
        };
    }

    return resolvedPlacements;
}

function buildResolvedSdkConfig(
    sdkConfig: SdkConfig | null | undefined,
    lang: Language
): ResolvedSdkConfig | undefined {
    if (!sdkConfig) return undefined;

    const mergedTranslations = mergeTranslations(
        sdkConfig.translations?.default,
        sdkConfig.translations?.[lang]
    );
    const resolvedPlacements = buildResolvedPlacements(
        sdkConfig.placements,
        lang
    );

    return {
        name: sdkConfig.name ?? undefined,
        logoUrl: sdkConfig.logoUrl ?? undefined,
        homepageLink: sdkConfig.homepageLink ?? undefined,
        currency: sdkConfig.currency ?? undefined,
        lang,
        ...(sdkConfig.hidden && { hidden: true }),
        css: sdkConfig.css ?? undefined,
        ...(mergedTranslations && { translations: mergedTranslations }),
        ...(resolvedPlacements && { placements: resolvedPlacements }),
    };
}

export const userMerchantApi = new Elysia({ prefix: "/merchant" })
    .get(
        "/resolve",
        async ({ query: { domain, lang } }) => {
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
                return status(404, "Merchant not found");
            }

            const productId =
                merchant.productId ?? keccak256(toHex(normalizedDomain));

            const resolvedLang = resolveLanguage(merchant.sdkConfig, lang);
            const resolvedSdkConfig = buildResolvedSdkConfig(
                merchant.sdkConfig,
                resolvedLang
            );

            return {
                merchantId: merchant.id,
                productId,
                name: merchant.name,
                domain: merchant.domain,
                allowedDomains: [merchant.domain],
                ...(resolvedSdkConfig && { sdkConfig: resolvedSdkConfig }),
            };
        },
        {
            query: t.Object({
                domain: t.String({ minLength: 1 }),
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
    .use(exploreApi);
