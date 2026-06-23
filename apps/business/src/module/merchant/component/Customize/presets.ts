import { type Currency, formatAmount } from "@frak-labs/core-sdk";

/**
 * Curated wording presets written into the SDK config. Stored values keep the
 * `{REWARD}` token (interpolated by the SDK at display time); `{Brand}` has no
 * SDK token and is substituted with the shop name before storing.
 */
export const BUTTON_SHARE_PRESETS = [
    "Share & earn {REWARD}!",
    "Invite friends & earn {REWARD}!",
    "Refer friends and earn {REWARD}",
    "Recommend & earn {REWARD}",
] as const;

export const POST_PURCHASE_PRESETS = [
    "You just earned {REWARD}! Share with friends to earn even more.",
    "{REWARD} earned so far. Keep sharing to grow your rewards.",
    "{REWARD} earned so far. Your next reward could be just one share away.",
    "Earned {REWARD} already. Keep sharing to grow your rewards.",
] as const;

export type BannerPreset = { title: string; description: string };

export const BANNER_PRESETS: readonly BannerPreset[] = [
    {
        title: "Earn {REWARD} on purchases",
        description:
            "Earn rewards after your purchase via the Frak partner app.",
    },
    {
        title: "You've been invited to earn {REWARD}",
        description: "Complete your purchase and claim your reward with Frak.",
    },
    {
        title: "A friend unlocked {REWARD} for you",
        description:
            "Shop with {Brand} and collect your reward after purchase.",
    },
    {
        title: "Your {REWARD} reward is waiting",
        description:
            "Complete your purchase and collect your reward through the Frak app after checkout.",
    },
] as const;

export function applyBrand(text: string, shopName: string): string {
    return text.replace(/\{Brand\}/g, shopName);
}

function matchPreset(presets: readonly string[], value: string): number | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const index = presets.indexOf(trimmed);
    return index === -1 ? null : index;
}

export function matchButtonSharePreset(text: string): number | null {
    return matchPreset(BUTTON_SHARE_PRESETS, text);
}

export function matchPostPurchasePreset(text: string): number | null {
    return matchPreset(POST_PURCHASE_PRESETS, text);
}

export function matchBannerPreset(
    title: string,
    description: string,
    shopName: string
): number | null {
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    if (!trimmedTitle || !trimmedDescription) return null;
    const index = BANNER_PRESETS.findIndex(
        (preset) =>
            applyBrand(preset.title, shopName) === trimmedTitle &&
            applyBrand(preset.description, shopName) === trimmedDescription
    );
    return index === -1 ? null : index;
}

/** Render a stored preset value for display, with a sample reward amount. */
export function formatPresetLabel(text: string, currency: Currency): string {
    return text.replace(/\{REWARD\}/g, formatAmount(42, currency));
}
