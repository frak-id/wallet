/**
 * Pure dirty-diff and save-time validation helpers for the deferred-save
 * forms (Explorer, Customizations). Extracted so the logic can be unit
 * tested without a component-test harness.
 */
import { isValidUrl } from "@frak-labs/app-essentials";

/**
 * Imperative handle exposed by the deferred-save appearance tabs so the
 * route can pull dirty state at tab-switch time instead of having each tab
 * push it up via an effect (only one tab is ever mounted at a time).
 */
export type AppearanceFormHandle = {
    isDirty: () => boolean;
};

export type ExplorerFormState = {
    enabled: boolean;
    logoUrl: string;
    heroImageUrl: string;
    heroImageUrls: string[];
    description: string;
};

/**
 * True when any Explorer field differs from its loaded defaults.
 */
export function isExplorerFormDirty(
    pending: ExplorerFormState,
    defaults: ExplorerFormState
): boolean {
    return (
        pending.enabled !== defaults.enabled ||
        pending.logoUrl !== defaults.logoUrl ||
        pending.heroImageUrl !== defaults.heroImageUrl ||
        pending.heroImageUrls.join(",") !== defaults.heroImageUrls.join(",") ||
        pending.description !== defaults.description
    );
}

/**
 * True when the Customizations logo URL differs from its loaded default.
 */
export function isCustomizationsFormDirty(
    pendingLogoUrl: string,
    defaultLogoUrl: string
): boolean {
    return pendingLogoUrl !== defaultLogoUrl;
}

export type ExplorerSaveValidation =
    | { canSave: true; settingsToSave: ExplorerFormState }
    | { canSave: false; logoError: boolean; heroError: boolean };

/**
 * Save-time URL validation for the Explorer form, re-homed from the old
 * auto-save's disable-drops-invalid-URLs rule (the Save Bar's Save button
 * can't be conditionally disabled like the old inline button):
 * - If the listing is being turned off, an invalid logo/hero URL doesn't
 *   block Save — it's silently dropped so garbage never reaches storage.
 * - Otherwise (listing on, or staying on), Save is blocked until the
 *   merchant fixes the invalid URL(s).
 */
export function validateExplorerSave(
    pending: ExplorerFormState
): ExplorerSaveValidation {
    // Empty is a legitimate "no image" value (not invalid) — only a non-empty
    // malformed URL blocks Save.
    const logoValid = !pending.logoUrl || isValidUrl(pending.logoUrl);
    const heroValid = !pending.heroImageUrl || isValidUrl(pending.heroImageUrl);

    if (logoValid && heroValid) {
        return { canSave: true, settingsToSave: pending };
    }

    if (!pending.enabled) {
        return {
            canSave: true,
            settingsToSave: {
                ...pending,
                logoUrl: logoValid ? pending.logoUrl : "",
                heroImageUrl: heroValid ? pending.heroImageUrl : "",
            },
        };
    }

    return { canSave: false, logoError: !logoValid, heroError: !heroValid };
}
