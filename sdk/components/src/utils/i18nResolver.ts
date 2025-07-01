import type { I18nConfig } from "@frak-labs/core-sdk";

/**
 * Resolves i18n configuration when a campaign id is specified
 * 1. window.FrakSetup.campaignI18n[campaignId] (campaign-specific)
 * 2. window.FrakSetup.config.customizations.i18n (global fallback)
 *
 * @param campaignId - Campaign identifier for campaign-specific i18n lookup
 * @returns Resolved i18n configuration or undefined
 */
export function resolveI18nConfig({
    campaignId,
}: {
    campaignId?: string;
} = {}): I18nConfig | undefined {
    // Priority 1: Campaign-specific config from global setup
    if (campaignId && window.FrakSetup?.campaignI18n?.[campaignId]) {
        return window.FrakSetup.campaignI18n[campaignId];
    }

    // Priority 2: Global config fallback
    return undefined;
}
