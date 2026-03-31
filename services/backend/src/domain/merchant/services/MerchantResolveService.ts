import { processCss, processScopedCss } from "@backend-utils";
import type { Language } from "@frak-labs/core-sdk";
import { LRUCache } from "lru-cache";
import { keccak256, toHex } from "viem";
import type {
    MerchantResolveResponse,
    ResolvedPlacement,
    ResolvedSdkConfig,
} from "../../../api/schemas";
import type { MerchantRepository } from "../repositories/MerchantRepository";
import type { Placement, SdkConfig } from "../schemas";

function processRawCss(rawCss: string | null | undefined): string | undefined {
    if (rawCss) return processCss(rawCss);
    return rawCss ?? undefined;
}

function processRawScopedCss(
    rawCss: string | undefined,
    scope: string
): string | undefined {
    if (rawCss) return processScopedCss(rawCss, scope);
    return rawCss;
}

function stripRawCss<T extends { rawCss?: unknown }>(
    obj: T
): Omit<T, "rawCss"> {
    const { rawCss: _, ...rest } = obj;
    return rest;
}

export class MerchantResolveService {
    private readonly responseCache = new LRUCache<
        string,
        { value: MerchantResolveResponse }
    >({
        max: 512,
        ttl: 60 * 60 * 1000,
    });

    constructor(readonly merchantRepository: MerchantRepository) {}

    processSdkConfigCss(config: SdkConfig): SdkConfig {
        const result = { ...config };

        if (result.rawCss !== undefined) {
            result.css = processRawCss(result.rawCss);
        }

        if (result.placements) {
            const processedPlacements: NonNullable<SdkConfig["placements"]> =
                {};
            for (const [id, placement] of Object.entries(result.placements)) {
                processedPlacements[id] = this.processPlacementCss(
                    id,
                    placement
                );
            }
            result.placements = processedPlacements;
        }

        return result;
    }

    async resolve(
        normalizedDomain: string,
        lang: string | undefined
    ): Promise<MerchantResolveResponse | null> {
        const cacheKey = `${normalizedDomain}:${lang ?? ""}`;
        const cached = this.responseCache.get(cacheKey);
        if (cached) return cached.value;

        const merchant =
            await this.merchantRepository.findByDomain(normalizedDomain);
        if (!merchant) return null;

        const productId =
            merchant.productId ?? keccak256(toHex(normalizedDomain));
        const resolvedLang = this.resolveLanguage(merchant.sdkConfig, lang);
        const resolvedSdkConfig = this.buildResolvedSdkConfig(
            merchant.sdkConfig,
            resolvedLang
        );

        const response: MerchantResolveResponse = {
            merchantId: merchant.id,
            productId,
            name: merchant.name,
            domain: merchant.domain,
            allowedDomains: [merchant.domain],
            ...(resolvedSdkConfig && { sdkConfig: resolvedSdkConfig }),
        };

        this.responseCache.set(cacheKey, { value: response });
        return response;
    }

    invalidateForDomain(domain: string): void {
        this.responseCache.delete(`${domain}:`);
        this.responseCache.delete(`${domain}:fr`);
        this.responseCache.delete(`${domain}:en`);
    }

    private processPlacementCss(
        placementId: string,
        placement: Placement
    ): Placement {
        const result = { ...placement };

        if (result.rawCss !== undefined) {
            result.css = processRawCss(result.rawCss);
        }

        if (result.components) {
            result.components = this.processComponentsCss(
                placementId,
                result.components
            );
        }

        return result;
    }

    private processComponentsCss(
        placementId: string,
        components: NonNullable<Placement["components"]>
    ): NonNullable<Placement["components"]> {
        const result = { ...components };

        if (result.buttonShare?.rawCss !== undefined) {
            result.buttonShare = {
                ...result.buttonShare,
                css: processRawScopedCss(
                    result.buttonShare.rawCss,
                    `frak-button-share[placement="${placementId}"]`
                ),
            };
        }

        if (result.buttonWallet?.rawCss !== undefined) {
            result.buttonWallet = {
                ...result.buttonWallet,
                css: processRawCss(result.buttonWallet.rawCss),
            };
        }

        if (result.openInApp?.rawCss !== undefined) {
            result.openInApp = {
                ...result.openInApp,
                css: processRawScopedCss(
                    result.openInApp.rawCss,
                    `frak-open-in-app[placement="${placementId}"]`
                ),
            };
        }

        return result;
    }

    private resolveLanguage(
        sdkConfig: SdkConfig | null | undefined,
        queryLang: string | undefined
    ): Language {
        if (sdkConfig?.lang) return sdkConfig.lang;
        if (queryLang === "fr" || queryLang === "en") return queryLang;
        return "en";
    }

    private mergeTranslations(
        defaultTranslations: Record<string, string> | undefined,
        langTranslations: Record<string, string> | undefined
    ): Record<string, string> | undefined {
        if (!defaultTranslations && !langTranslations) return undefined;
        return { ...defaultTranslations, ...langTranslations };
    }

    private buildResolvedPlacements(
        placements: SdkConfig["placements"],
        lang: Language
    ): Record<string, ResolvedPlacement> | undefined {
        if (!placements) return undefined;

        const resolvedPlacements: Record<string, ResolvedPlacement> = {};
        for (const [id, placement] of Object.entries(placements)) {
            const placementTranslations = this.mergeTranslations(
                placement.translations?.default,
                placement.translations?.[lang]
            );

            resolvedPlacements[id] = {
                ...(placement.components && {
                    components: {
                        ...(placement.components.buttonShare && {
                            buttonShare: stripRawCss(
                                placement.components.buttonShare
                            ),
                        }),
                        ...(placement.components.buttonWallet && {
                            buttonWallet: stripRawCss(
                                placement.components.buttonWallet
                            ),
                        }),
                        ...(placement.components.openInApp && {
                            openInApp: stripRawCss(
                                placement.components.openInApp
                            ),
                        }),
                    },
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

    private buildResolvedSdkConfig(
        sdkConfig: SdkConfig | null | undefined,
        lang: Language
    ): ResolvedSdkConfig | undefined {
        if (!sdkConfig) return undefined;

        const mergedTranslations = this.mergeTranslations(
            sdkConfig.translations?.default,
            sdkConfig.translations?.[lang]
        );
        const resolvedPlacements = this.buildResolvedPlacements(
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
}
