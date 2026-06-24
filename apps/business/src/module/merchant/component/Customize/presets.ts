import { type Currency, formatAmount } from "@frak-labs/core-sdk";
import type { PresetLang } from "./types";

/**
 * Curated wording presets written into the SDK config. Each preset ships both
 * languages so picking one fills `en` + `fr` at once, regardless of the active
 * editor tab. Stored values keep the `{REWARD}` token (interpolated by the SDK
 * at display time); `{Brand}` has no SDK token and is substituted with the shop
 * name before storing.
 */
export type LocalizedPreset = Record<PresetLang, string>;

export const BUTTON_SHARE_PRESETS: readonly LocalizedPreset[] = [
    { en: "Share & earn {REWARD}!", fr: "Partagez et gagnez {REWARD} !" },
    {
        en: "Invite friends & earn {REWARD}!",
        fr: "Invitez vos amis et gagnez {REWARD} !",
    },
    {
        en: "Refer friends and earn {REWARD}",
        fr: "Parrainez vos amis et gagnez {REWARD}",
    },
    { en: "Recommend & earn {REWARD}", fr: "Recommandez et gagnez {REWARD}" },
];

/**
 * Post-purchase presets ship both the referee message (shown to the buyer who
 * just earned a reward) and the referrer message (shown to the sharer), each in
 * en + fr. Picking one fills all four fields at once.
 */
export type PostPurchasePreset = {
    referee: LocalizedPreset;
    referrer: LocalizedPreset;
};

export const POST_PURCHASE_PRESETS: readonly PostPurchasePreset[] = [
    {
        referee: {
            en: "You just earned {REWARD}! Share with friends to earn even more.",
            fr: "Vous venez de gagner {REWARD} ! Partagez avec vos amis pour gagner encore plus.",
        },
        referrer: {
            en: "Earn {REWARD} by sharing this with your friends!",
            fr: "Gagnez {REWARD} en partageant avec vos amis !",
        },
    },
    {
        referee: {
            en: "{REWARD} earned so far. Keep sharing to grow your rewards.",
            fr: "{REWARD} gagnés jusqu'ici. Continuez à partager pour augmenter vos récompenses.",
        },
        referrer: {
            en: "Share with friends to grow your rewards — earn {REWARD} each time.",
            fr: "Partagez avec vos amis pour augmenter vos récompenses — gagnez {REWARD} à chaque fois.",
        },
    },
    {
        referee: {
            en: "{REWARD} earned so far. Your next reward could be just one share away.",
            fr: "{REWARD} gagnés jusqu'ici. Votre prochaine récompense n'est qu'à un partage.",
        },
        referrer: {
            en: "Your next {REWARD} is just one share away.",
            fr: "Votre prochaine récompense de {REWARD} n'est qu'à un partage.",
        },
    },
    {
        referee: {
            en: "Earned {REWARD} already. Keep sharing to grow your rewards.",
            fr: "Déjà {REWARD} gagnés. Continuez à partager pour augmenter vos récompenses.",
        },
        referrer: {
            en: "Keep sharing and earn {REWARD} for every friend.",
            fr: "Continuez à partager et gagnez {REWARD} pour chaque ami.",
        },
    },
];

export type BannerPreset = { title: string; description: string };
export type LocalizedBannerPreset = Record<PresetLang, BannerPreset>;

export const BANNER_PRESETS: readonly LocalizedBannerPreset[] = [
    {
        en: {
            title: "Earn {REWARD} on purchases",
            description:
                "Earn rewards after your purchase via the Frak partner app.",
        },
        fr: {
            title: "Gagnez {REWARD} sur vos achats",
            description:
                "Gagnez des récompenses après votre achat via l'application partenaire Frak.",
        },
    },
    {
        en: {
            title: "You've been invited to earn {REWARD}",
            description:
                "Complete your purchase and claim your reward with Frak.",
        },
        fr: {
            title: "Vous avez été invité à gagner {REWARD}",
            description:
                "Finalisez votre achat et réclamez votre récompense avec Frak.",
        },
    },
    {
        en: {
            title: "A friend unlocked {REWARD} for you",
            description:
                "Shop with {Brand} and collect your reward after purchase.",
        },
        fr: {
            title: "Un ami vous a débloqué {REWARD}",
            description:
                "Achetez chez {Brand} et récupérez votre récompense après votre achat.",
        },
    },
    {
        en: {
            title: "Your {REWARD} reward is waiting",
            description:
                "Complete your purchase and collect your reward through the Frak app after checkout.",
        },
        fr: {
            title: "Votre récompense de {REWARD} vous attend",
            description:
                "Finalisez votre achat et récupérez votre récompense via l'application Frak après le paiement.",
        },
    },
];

export function applyBrand(text: string, shopName: string): string {
    return text.replace(/\{Brand\}/g, shopName);
}

// Presets are matched on their canonical `en` copy: selecting a preset writes
// both languages, so the `en` value alone identifies it.
function matchPreset(
    presets: readonly LocalizedPreset[],
    value: string
): number | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const index = presets.findIndex((preset) => preset.en === trimmed);
    return index === -1 ? null : index;
}

export function matchButtonSharePreset(enText: string): number | null {
    return matchPreset(BUTTON_SHARE_PRESETS, enText);
}

// Matched on the canonical referee `en` copy: selecting a preset writes both
// audiences in both languages, so the referee `en` value alone identifies it.
export function matchPostPurchasePreset(enText: string): number | null {
    const trimmed = enText.trim();
    if (!trimmed) return null;
    const index = POST_PURCHASE_PRESETS.findIndex(
        (preset) => preset.referee.en === trimmed
    );
    return index === -1 ? null : index;
}

export function matchBannerPreset(
    enTitle: string,
    enDescription: string,
    shopName: string
): number | null {
    const trimmedTitle = enTitle.trim();
    const trimmedDescription = enDescription.trim();
    if (!trimmedTitle || !trimmedDescription) return null;
    const index = BANNER_PRESETS.findIndex(
        (preset) =>
            applyBrand(preset.en.title, shopName) === trimmedTitle &&
            applyBrand(preset.en.description, shopName) === trimmedDescription
    );
    return index === -1 ? null : index;
}

/** Render a stored preset value for display, with a sample reward amount. */
export function formatPresetLabel(text: string, currency: Currency): string {
    return text.replace(/\{REWARD\}/g, formatAmount(42, currency));
}
