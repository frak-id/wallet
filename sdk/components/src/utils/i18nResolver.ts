import type {
    CampaignI18nConfig,
    EnhancedI18nConfig,
    I18nConfig,
} from "@frak-labs/core-sdk";

/**
 * Type guard to check if an i18n config is an enhanced config
 */
function isEnhancedI18nConfig(
    config: I18nConfig | EnhancedI18nConfig | undefined
): config is EnhancedI18nConfig {
    return (
        config !== undefined &&
        typeof config === "object" &&
        !Array.isArray(config) &&
        typeof config !== "string" &&
        ("global" in config || "campaigns" in config)
    );
}

/**
 * Resolves i18n configuration based on the hierarchy:
 * 1. campaignI18n prop (highest priority)
 * 2. enhanced config campaigns[campaignId]
 * 3. enhanced config global
 * 4. global config (lowest priority)
 *
 * @param options - Resolution options
 * @param options.campaignId - The campaign ID to look up specific config
 * @param options.campaignI18n - Direct campaign i18n override (highest priority)
 * @param options.globalConfig - The global/fallback i18n config
 * @returns The resolved i18n config
 */
export function resolveI18nConfig({
    campaignId,
    campaignI18n,
    globalConfig,
}: {
    campaignId?: string;
    campaignI18n?: CampaignI18nConfig;
    globalConfig?: I18nConfig | EnhancedI18nConfig;
}): I18nConfig | undefined {
    // 1. If campaignI18n prop is provided, use it (highest priority)
    if (campaignI18n) {
        return campaignI18n;
    }

    // 2. Check if globalConfig is enhanced and has campaign-specific config
    if (isEnhancedI18nConfig(globalConfig) && campaignId) {
        const campaignSpecificConfig = globalConfig.campaigns?.[campaignId];
        if (campaignSpecificConfig) {
            return campaignSpecificConfig;
        }
    }

    // 3. If globalConfig is enhanced, use its global config
    if (isEnhancedI18nConfig(globalConfig)) {
        if (globalConfig.global) {
            return globalConfig.global;
        }
    }

    // 4. If globalConfig is a regular I18nConfig, use it (lowest priority)
    if (globalConfig && !isEnhancedI18nConfig(globalConfig)) {
        return globalConfig;
    }

    // No config found
    return undefined;
}

/**
 * Convenience function to resolve i18n config from the global FrakSetup
 *
 * @param options - Resolution options
 * @param options.campaignId - The campaign ID to look up specific config
 * @param options.campaignI18n - Direct campaign i18n override (highest priority)
 * @returns The resolved i18n config
 */
export function resolveI18nFromGlobalSetup({
    campaignId,
    campaignI18n,
}: {
    campaignId?: string;
    campaignI18n?: CampaignI18nConfig;
} = {}): I18nConfig | undefined {
    return resolveI18nConfig({
        campaignId,
        campaignI18n,
        globalConfig: window.FrakSetup?.config?.customizations?.i18n,
    });
}
