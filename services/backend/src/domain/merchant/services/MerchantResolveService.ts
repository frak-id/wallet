import { processCss, processScopedCss } from "@backend-utils";
import type { Language } from "@frak-labs/core-sdk";
import { LRUCache } from "lru-cache";
import { keccak256, toHex } from "viem";
import type { MerchantRepository } from "../repositories/MerchantRepository";
import type {
    LocalizableString,
    MerchantResolveResponse,
    Placement,
    ResolvedPlacement,
    ResolvedSdkConfig,
    SdkConfig,
} from "../schemas";

function processRawCss(rawCss: string | null | undefined): string | undefined {
    if (rawCss) return processCss(rawCss);
    return rawCss ?? undefined;
}

function resolveLocalizable(
    value: LocalizableString | undefined,
    lang: Language
): string | undefined {
    if (value === undefined) return undefined;
    if (typeof value === "string") return value;
    // Fall through lang -> default -> other langs so a partially-translated
    // field never renders blank.
    return value[lang] ?? value.default ?? value.en ?? value.fr;
}

/**
 * Resolve a fixed set of localizable text fields on a component to plain
 * per-language strings, dropping any that resolve to `undefined`. Keyed by the
 * field names so each component just declares which of its keys are localizable.
 */
function resolveLocalizableFields<K extends string>(
    component: Partial<Record<K, LocalizableString>>,
    fields: readonly K[],
    lang: Language
): Partial<Record<K, string>> {
    const resolved: Partial<Record<K, string>> = {};
    for (const field of fields) {
        const value = resolveLocalizable(component[field], lang);
        if (value !== undefined) resolved[field] = value;
    }
    return resolved;
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
        ttl: 10 * 60 * 1000,
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

        if (result.components) {
            result.components = this.processComponentsCss(result.components);
        }

        return result;
    }

    private normalizeQueryLang(
        lang: string | undefined
    ): "en" | "fr" | undefined {
        if (lang === "en" || lang === "fr") return lang;
        return undefined;
    }

    async resolve({
        id,
        domain,
        lang,
    }: {
        id?: string;
        domain?: string;
        lang?: string;
    }): Promise<MerchantResolveResponse | null> {
        const safeLang = this.normalizeQueryLang(lang);
        const cacheKey = id
            ? `${id}:${safeLang ?? ""}`
            : `${domain}:${safeLang ?? ""}`;
        const cached = this.responseCache.get(cacheKey);
        if (cached) return cached.value;

        const merchant = id
            ? await this.merchantRepository.findById(id)
            : domain
              ? ((await this.merchantRepository.findByDomain(domain)) ??
                (await this.merchantRepository.findByAllowedDomain(domain)))
              : null;
        if (!merchant) return null;

        const productId =
            merchant.productId ?? keccak256(toHex(domain ?? merchant.domain));
        const resolvedLang = this.resolveLanguage(merchant.sdkConfig, safeLang);
        const resolvedSdkConfig = this.buildResolvedSdkConfig(
            merchant.sdkConfig,
            resolvedLang
        );

        const response: MerchantResolveResponse = {
            merchantId: merchant.id,
            productId,
            name: merchant.name,
            domain: merchant.domain,
            allowedDomains: [
                merchant.domain,
                ...(merchant.allowedDomains ?? []),
            ],
            ...(resolvedSdkConfig && { sdkConfig: resolvedSdkConfig }),
        };

        this.responseCache.set(cacheKey, { value: response });
        return response;
    }

    invalidateForMerchant(merchant: {
        id: string;
        domain: string;
        allowedDomains?: string[] | null;
    }): void {
        const langs = ["", "fr", "en"] as const;
        const domains = [merchant.domain, ...(merchant.allowedDomains ?? [])];
        for (const domain of domains) {
            for (const lang of langs) {
                this.responseCache.delete(`${domain}:${lang}`);
            }
        }
        for (const lang of langs) {
            this.responseCache.delete(`${merchant.id}:${lang}`);
        }
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
                result.components,
                placementId
            );
        }

        return result;
    }

    /**
     * Sanitize each component's `rawCss` into scoped/minified `css`. With a
     * `placementId`, the share/open-in-app/banner elements are scoped to that
     * placement; `buttonWallet` is a fixed overlay and is never scoped. The
     * same component shape backs both placement-level and global config.
     */
    private processComponentsCss(
        components: NonNullable<SdkConfig["components"]>,
        placementId?: string
    ): NonNullable<SdkConfig["components"]> {
        const scoped = (rawCss: string, element: string) =>
            placementId
                ? processRawScopedCss(
                      rawCss,
                      `${element}[placement="${placementId}"]`
                  )
                : processRawCss(rawCss);

        const result = { ...components };

        if (result.buttonShare?.rawCss !== undefined) {
            result.buttonShare = {
                ...result.buttonShare,
                css: scoped(result.buttonShare.rawCss, "frak-button-share"),
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
                css: scoped(result.openInApp.rawCss, "frak-open-in-app"),
            };
        }

        if (result.banner?.rawCss !== undefined) {
            result.banner = {
                ...result.banner,
                css: scoped(result.banner.rawCss, "frak-banner"),
            };
        }

        return result;
    }

    private resolveLanguage(
        sdkConfig: SdkConfig | null | undefined,
        queryLang: Language | undefined
    ): Language {
        return sdkConfig?.lang ?? queryLang ?? "en";
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
                    components: this.buildResolvedComponents(
                        placement.components,
                        lang
                    ),
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
            ...(sdkConfig.components && {
                components: this.buildResolvedComponents(
                    sdkConfig.components,
                    lang
                ),
            }),
            ...(sdkConfig.attribution && {
                attribution: sdkConfig.attribution,
            }),
        };
    }

    private buildResolvedComponents(
        components: NonNullable<SdkConfig["components"]>,
        lang: Language
    ): ResolvedPlacement["components"] {
        const { buttonShare, buttonWallet, openInApp, postPurchase, banner } =
            components;
        return {
            ...(buttonShare && {
                buttonShare: {
                    ...resolveLocalizableFields(
                        buttonShare,
                        ["text", "noRewardText"] as const,
                        lang
                    ),
                    ...(buttonShare.clickAction && {
                        clickAction: buttonShare.clickAction,
                    }),
                    ...(buttonShare.css && { css: buttonShare.css }),
                },
            }),
            ...(buttonWallet && { buttonWallet: stripRawCss(buttonWallet) }),
            ...(openInApp && {
                openInApp: {
                    ...resolveLocalizableFields(
                        openInApp,
                        ["text"] as const,
                        lang
                    ),
                    ...(openInApp.css && { css: openInApp.css }),
                },
            }),
            ...(postPurchase && {
                postPurchase: {
                    ...resolveLocalizableFields(
                        postPurchase,
                        [
                            "refereeText",
                            "refereeNoRewardText",
                            "referrerText",
                            "referrerNoRewardText",
                            "ctaText",
                            "ctaNoRewardText",
                            "badgeText",
                        ] as const,
                        lang
                    ),
                    ...(postPurchase.imageUrl && {
                        imageUrl: postPurchase.imageUrl,
                    }),
                    ...(postPurchase.css && { css: postPurchase.css }),
                },
            }),
            ...(banner && {
                banner: {
                    ...resolveLocalizableFields(
                        banner,
                        [
                            "referralTitle",
                            "referralDescription",
                            "referralCta",
                            "inappTitle",
                            "inappDescription",
                            "inappCta",
                        ] as const,
                        lang
                    ),
                    ...(banner.imageUrl && { imageUrl: banner.imageUrl }),
                    ...(banner.css && { css: banner.css }),
                },
            }),
        };
    }
}
