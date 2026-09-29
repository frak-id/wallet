import { componentDefaults } from "@frak-labs/components/i18n/defaults";
import { type Currency, formatAmount } from "@frak-labs/core-sdk";
import type { AmbassadorTextField } from "./ambassadorForm";
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
    // Index 0 is the single source of truth shared with the SDK's built-in
    // default copy (`@frak-labs/components/i18n/defaults`) — a fresh merchant
    // renders exactly this wording before any customization.
    {
        en: componentDefaults.en.buttonShare.text,
        fr: componentDefaults.fr.buttonShare.text,
    },
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
    // Index 0 mirrors the SDK's built-in default copy (see BUTTON_SHARE_PRESETS).
    {
        referee: {
            en: componentDefaults.en.postPurchase.refereeText,
            fr: componentDefaults.fr.postPurchase.refereeText,
        },
        referrer: {
            en: componentDefaults.en.postPurchase.referrerText,
            fr: componentDefaults.fr.postPurchase.referrerText,
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
    // Index 0 mirrors the SDK's built-in default copy (see BUTTON_SHARE_PRESETS).
    // `referralTitleReward` is the reward-bearing title variant the SDK uses
    // when an estimated reward is available.
    {
        en: {
            title: componentDefaults.en.banner.referralTitleReward,
            description: componentDefaults.en.banner.referralDescription,
        },
        fr: {
            title: componentDefaults.fr.banner.referralTitleReward,
            description: componentDefaults.fr.banner.referralDescription,
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

export const AMBASSADOR_FAQ_PRESET_FIELDS = [
    "faq1Question",
    "faq1Answer",
    "faq2Question",
    "faq2Answer",
    "faq3Question",
    "faq3Answer",
    "faq4Question",
    "faq4Answer",
] as const satisfies readonly AmbassadorTextField[];

type AmbassadorFaqPresetField = (typeof AMBASSADOR_FAQ_PRESET_FIELDS)[number];
type AmbassadorFaqCopy = Record<AmbassadorFaqPresetField, string>;

export type AmbassadorFaqPreset = {
    key: "classic" | "earnings" | "trust" | "casual";
    en: AmbassadorFaqCopy;
    fr: AmbassadorFaqCopy;
};

const ambassadorDefaultsEn = componentDefaults.en.ambassador;
const ambassadorDefaultsFr = componentDefaults.fr.ambassador;

// `{BRAND}` stays a literal token for the SDK to substitute. `{REWARD}` is
// never used: the SDK drops an override containing it when no reward is known,
// which would pair the preset question with the default answer.
export const AMBASSADOR_FAQ_PRESETS: readonly AmbassadorFaqPreset[] = [
    // Index 0 mirrors the SDK's built-in default copy (see BUTTON_SHARE_PRESETS).
    {
        key: "classic",
        en: {
            faq1Question: ambassadorDefaultsEn.faq1Question,
            faq1Answer: ambassadorDefaultsEn.faq1Answer,
            faq2Question: ambassadorDefaultsEn.faq2Question,
            faq2Answer: ambassadorDefaultsEn.faq2Answer,
            faq3Question: ambassadorDefaultsEn.faq3Question,
            faq3Answer: ambassadorDefaultsEn.faq3Answer,
            faq4Question: ambassadorDefaultsEn.faq4Question,
            faq4Answer: ambassadorDefaultsEn.faq4Answer,
        },
        fr: {
            faq1Question: ambassadorDefaultsFr.faq1Question,
            faq1Answer: ambassadorDefaultsFr.faq1Answer,
            faq2Question: ambassadorDefaultsFr.faq2Question,
            faq2Answer: ambassadorDefaultsFr.faq2Answer,
            faq3Question: ambassadorDefaultsFr.faq3Question,
            faq3Answer: ambassadorDefaultsFr.faq3Answer,
            faq4Question: ambassadorDefaultsFr.faq4Question,
            faq4Answer: ambassadorDefaultsFr.faq4Answer,
        },
    },
    {
        key: "earnings",
        en: {
            faq1Question: "How much can I earn?",
            faq1Answer:
                "You earn a reward for every order placed through your link. The amount is shown at the top of this page, and the more friends order, the more you earn.",
            faq2Question: "When is my money available?",
            faq2Answer:
                "Your earnings are credited to your Frak wallet as soon as a friend orders, and become transferable once {BRAND} confirms the purchase.",
            faq3Question: "Do my friends pay more with my link?",
            faq3Answer:
                "No. They pay the usual price and also get a reward on their order.",
            faq4Question: "How do I get my money?",
            faq4Answer:
                "From the Frak app, transfer your earnings to your bank account whenever you like, with no fees and no minimum amount.",
        },
        fr: {
            faq1Question: "Combien je peux gagner\u00A0?",
            faq1Answer:
                "Vous gagnez une récompense pour chaque commande passée via votre lien. Le montant est indiqué en haut de cette page, et plus vos amis commandent, plus vous gagnez.",
            faq2Question: "Quand mon argent est-il disponible\u00A0?",
            faq2Answer:
                "Vos gains sont crédités dans votre porte-monnaie Frak dès qu’un ami commande, et deviennent transférables une fois l’achat confirmé par {BRAND}.",
            faq3Question: "Mes amis paient-ils plus cher avec mon lien\u00A0?",
            faq3Answer:
                "Non. Ils paient le prix habituel et reçoivent eux aussi une récompense sur leur commande.",
            faq4Question: "Comment je récupère mon argent\u00A0?",
            faq4Answer:
                "Depuis l’app Frak, transférez vos gains vers votre compte bancaire quand vous le souhaitez, sans frais et sans montant minimum.",
        },
    },
    {
        key: "trust",
        en: {
            faq1Question: "How does {BRAND} know the sale came from me?",
            faq1Answer:
                "Your link is unique to you. Every order placed through it is recorded automatically, and you can follow your earnings in real time in the Frak app.",
            faq2Question: "Is my data safe?",
            faq2Answer:
                "Yes. You sign in with your phone’s biometrics, with no password to remember, and Frak never sells any data to third parties.",
            faq3Question: "Do my friends pay more with my link?",
            faq3Answer:
                "No. The price stays the same, and your friends get a reward on their order too.",
            faq4Question: "Why is it free?",
            faq4Answer:
                "{BRAND} funds the rewards: it would rather reward its customers’ recommendations than spend on advertising. You never pay anything.",
        },
        fr: {
            faq1Question:
                "Comment {BRAND} sait que la vente vient de moi\u00A0?",
            faq1Answer:
                "Votre lien vous est propre. Chaque commande passée avec est enregistrée automatiquement, et vous suivez vos gains en temps réel dans l’app Frak.",
            faq2Question: "Mes données sont-elles protégées\u00A0?",
            faq2Answer:
                "Oui. Vous vous connectez avec la biométrie de votre téléphone, sans mot de passe à retenir, et Frak ne vend aucune donnée à des tiers.",
            faq3Question: "Mes amis paient-ils plus cher avec mon lien\u00A0?",
            faq3Answer:
                "Non. Le prix reste le même, et vos proches reçoivent eux aussi une récompense sur leur commande.",
            faq4Question: "Pourquoi c’est gratuit\u00A0?",
            faq4Answer:
                "C’est {BRAND} qui finance les récompenses\u00A0: la marque préfère récompenser les recommandations de ses clients plutôt que la publicité. Vous ne payez jamais rien.",
        },
    },
    {
        key: "casual",
        en: {
            faq1Question: "Is it free?",
            faq1Answer: "Yep, 100% free. No subscription, no fees.",
            faq2Question: "When do I get paid?",
            faq2Answer:
                "As soon as a friend orders, your earnings land in your Frak wallet. Transfer them to your bank once {BRAND} confirms the order.",
            faq3Question: "Do my friends pay more?",
            faq3Answer: "Nope. They even get a reward too.",
            faq4Question: "Do I need lots of followers?",
            faq4Answer:
                "Not at all. Share with whoever you like: friends, family, colleagues.",
        },
        fr: {
            faq1Question: "C’est gratuit\u00A0?",
            faq1Answer:
                "Oui, 100\u00A0% gratuit. Pas d’abonnement, pas de frais.",
            faq2Question: "Quand est-ce que je touche mes gains\u00A0?",
            faq2Answer:
                "Dès qu’un ami commande, tes gains arrivent dans ton porte-monnaie Frak. Tu les transfères vers ta banque une fois la commande confirmée par {BRAND}.",
            faq3Question: "Mes amis paient plus cher\u00A0?",
            faq3Answer: "Non. Ils sont même récompensés eux aussi.",
            faq4Question: "Il faut beaucoup de followers\u00A0?",
            faq4Answer:
                "Pas du tout. Partage avec qui tu veux\u00A0: amis, famille, collègues.",
        },
    },
];

/**
 * Copy for the OS share sheet (`sharing.title` / `sharing.text`), written to
 * `sdkConfig.translations` rather than `components`. `{{productName}}` is the
 * SDK's own binding for the merchant name; `{Brand}` is substituted here, so a
 * preset never ships both for the same slot.
 */
export type SharingPreset = { title: string; text: string };
export type LocalizedSharingPreset = Record<PresetLang, SharingPreset>;

export const SHARING_PRESETS: readonly LocalizedSharingPreset[] = [
    // Index 0 is the bundled default copy, verbatim from
    // `wallet-shared/i18n/locales/*/common.json` — a merchant who picks it
    // stores what an unconfigured merchant already renders.
    {
        en: {
            title: "{{productName}} invite link",
            text: "Discover this amazing product!",
        },
        fr: {
            title: "Lien d'invitation {{productName}}",
            text: "Découvrez ce produit incroyable !",
        },
    },
    {
        en: {
            title: "A gift from {Brand}",
            text: "I found this and thought of you — take a look.",
        },
        fr: {
            title: "Un cadeau de la part de {Brand}",
            text: "Je suis tombé·e là-dessus et j'ai pensé à toi — jette un œil.",
        },
    },
    {
        en: {
            title: "{Brand}, recommended by a friend",
            text: "Have a look at what I picked out for you.",
        },
        fr: {
            title: "{Brand}, recommandé par un ami",
            text: "Regarde ce que j'ai déniché pour toi.",
        },
    },
    {
        en: {
            title: "My pick from {Brand}",
            text: "Worth a look — tell me what you think.",
        },
        fr: {
            title: "Ma sélection chez {Brand}",
            text: "Ça vaut le coup d'œil — dis-moi ce que tu en penses.",
        },
    },
];

/**
 * The wallet's bundled `sharing.title` / `sharing.text`, mirrored verbatim from
 * the wallet-shared `common.json` locales. Named because the preview falls back
 * to it: reordering the array must not silently change what an unset tier
 * renders.
 */
export const BUNDLED_SHARING_DEFAULT = SHARING_PRESETS[0];

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

// Both slots, both sides trimmed, like `matchBannerPreset`: a preset writes
// title and text together, so title alone would keep the radio selected after a
// merchant edits only the text. An empty `shopName` — reachable while the
// merchant query loads — leaves substitution padding that must not defeat the
// comparison.
export function matchSharingPreset(
    enTitle: string,
    enText: string,
    shopName: string
): number | null {
    const trimmedTitle = enTitle.trim();
    const trimmedText = enText.trim();
    if (!trimmedTitle || !trimmedText) return null;
    const index = SHARING_PRESETS.findIndex(
        (preset) =>
            applyBrand(preset.en.title, shopName).trim() === trimmedTitle &&
            applyBrand(preset.en.text, shopName).trim() === trimmedText
    );
    return index === -1 ? null : index;
}

// A preset writes all 8 fields together, so every field must match: editing
// any one of them deselects it.
export function matchAmbassadorFaqPreset(en: AmbassadorFaqCopy): number | null {
    const trimmed = AMBASSADOR_FAQ_PRESET_FIELDS.map((field) =>
        en[field].trim()
    );
    if (trimmed.some((value) => !value)) return null;
    const index = AMBASSADOR_FAQ_PRESETS.findIndex((preset) =>
        AMBASSADOR_FAQ_PRESET_FIELDS.every(
            (field, i) => preset.en[field] === trimmed[i]
        )
    );
    return index === -1 ? null : index;
}

/**
 * Preview label for a sharing preset. Substitutes both interpolation styles so
 * a merchant reads their own name rather than a raw token: `{Brand}` is
 * resolved before storing, `{{productName}}` stays in the stored value and is
 * interpolated by the SDK, and neither should surface in the picker.
 */
export function formatSharingPreview(text: string, shopName: string): string {
    return applyBrand(text, shopName).replace(
        /\{\{\s*productName\s*\}\}/g,
        shopName
    );
}

/** Render a stored preset value for display, with a sample reward amount. */
export function formatPresetLabel(text: string, currency: Currency): string {
    return text.replace(/\{REWARD\}/g, formatAmount(42, currency));
}
