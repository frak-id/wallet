import { t } from "@backend-utils";
import type { Static } from "elysia";

export const ExplorerConfigSchema = t.Object({
    heroImageUrl: t.Optional(t.String({ format: "uri", maxLength: 2048 })),
    // Up to 4 additional hero images. The wallet slider renders them after heroImageUrl.
    heroImageUrls: t.Optional(
        t.Array(t.String({ format: "uri", maxLength: 2048 }), { maxItems: 4 })
    ),
    logoUrl: t.Optional(t.String({ format: "uri", maxLength: 2048 })),
    description: t.Optional(t.String({ maxLength: 1000 })),
});
export type ExplorerConfig = Static<typeof ExplorerConfigSchema>;

const TranslationOverridesSchema = t.Record(
    t.String(),
    t.String({ maxLength: 500 })
);

const TranslationTieredSchema = t.Object({
    default: t.Optional(TranslationOverridesSchema),
    en: t.Optional(TranslationOverridesSchema),
    fr: t.Optional(TranslationOverridesSchema),
});

// Either a single string (all languages) or a per-language map. Resolve
// flattens it to one string per request; a bare string keeps old configs valid.
const LocalizableStringSchema = t.Union([
    t.String({ maxLength: 500 }),
    t.Object({
        default: t.Optional(t.String({ maxLength: 500 })),
        en: t.Optional(t.String({ maxLength: 500 })),
        fr: t.Optional(t.String({ maxLength: 500 })),
    }),
]);
export type LocalizableString = Static<typeof LocalizableStringSchema>;

const ButtonShareComponentSchema = t.Object({
    text: t.Optional(LocalizableStringSchema),
    noRewardText: t.Optional(LocalizableStringSchema),
    clickAction: t.Optional(
        t.Union([
            t.Literal("embedded-wallet"),
            t.Literal("share-modal"),
            t.Literal("sharing-page"),
        ])
    ),
    rawCss: t.Optional(t.String({ maxLength: 50000 })),
    css: t.Optional(t.String({ maxLength: 50000 })),
});

const ButtonWalletComponentSchema = t.Object({
    position: t.Optional(t.Union([t.Literal("right"), t.Literal("left")])),
    rawCss: t.Optional(t.String({ maxLength: 50000 })),
    css: t.Optional(t.String({ maxLength: 50000 })),
});

const OpenInAppComponentSchema = t.Object({
    text: t.Optional(LocalizableStringSchema),
    rawCss: t.Optional(t.String({ maxLength: 50000 })),
    css: t.Optional(t.String({ maxLength: 50000 })),
});

const PostPurchaseComponentSchema = t.Object({
    refereeText: t.Optional(LocalizableStringSchema),
    refereeNoRewardText: t.Optional(LocalizableStringSchema),
    referrerText: t.Optional(LocalizableStringSchema),
    referrerNoRewardText: t.Optional(LocalizableStringSchema),
    ctaText: t.Optional(LocalizableStringSchema),
    ctaNoRewardText: t.Optional(LocalizableStringSchema),
    rawCss: t.Optional(t.String({ maxLength: 50000 })),
    css: t.Optional(t.String({ maxLength: 50000 })),
});

const BannerComponentSchema = t.Object({
    referralTitle: t.Optional(LocalizableStringSchema),
    referralDescription: t.Optional(LocalizableStringSchema),
    referralCta: t.Optional(LocalizableStringSchema),
    inappTitle: t.Optional(LocalizableStringSchema),
    inappDescription: t.Optional(LocalizableStringSchema),
    inappCta: t.Optional(LocalizableStringSchema),
    rawCss: t.Optional(t.String({ maxLength: 50000 })),
    css: t.Optional(t.String({ maxLength: 50000 })),
});

const PlacementComponentsSchema = t.Object({
    buttonShare: t.Optional(ButtonShareComponentSchema),
    buttonWallet: t.Optional(ButtonWalletComponentSchema),
    openInApp: t.Optional(OpenInAppComponentSchema),
    postPurchase: t.Optional(PostPurchaseComponentSchema),
    banner: t.Optional(BannerComponentSchema),
});

export const PlacementSchema = t.Object({
    components: t.Optional(PlacementComponentsSchema),
    targetInteraction: t.Optional(t.String({ maxLength: 200 })),
    translations: t.Optional(TranslationTieredSchema),
    rawCss: t.Optional(t.String({ maxLength: 50000 })),
    css: t.Optional(t.String({ maxLength: 50000 })),
});

const PlacementIdSchema = t.String({ pattern: "^[a-zA-Z0-9_-]{3,16}$" });

const AttributionDefaultsSchema = t.Object({
    utmSource: t.Optional(t.String({ maxLength: 200 })),
    utmMedium: t.Optional(t.String({ maxLength: 200 })),
    utmCampaign: t.Optional(t.String({ maxLength: 200 })),
    utmTerm: t.Optional(t.String({ maxLength: 200 })),
    via: t.Optional(t.String({ maxLength: 200 })),
    ref: t.Optional(t.String({ maxLength: 200 })),
});

const ResolvedComponentsSchema = t.Object({
    buttonShare: t.Optional(
        t.Object({
            text: t.Optional(t.String()),
            noRewardText: t.Optional(t.String()),
            clickAction: t.Optional(
                t.Union([
                    t.Literal("embedded-wallet"),
                    t.Literal("share-modal"),
                    t.Literal("sharing-page"),
                ])
            ),
            css: t.Optional(t.String()),
        })
    ),
    buttonWallet: t.Optional(
        t.Object({
            position: t.Optional(
                t.Union([t.Literal("right"), t.Literal("left")])
            ),
            css: t.Optional(t.String()),
        })
    ),
    openInApp: t.Optional(
        t.Object({
            text: t.Optional(t.String()),
            css: t.Optional(t.String()),
        })
    ),
    postPurchase: t.Optional(
        t.Object({
            refereeText: t.Optional(t.String()),
            refereeNoRewardText: t.Optional(t.String()),
            referrerText: t.Optional(t.String()),
            referrerNoRewardText: t.Optional(t.String()),
            ctaText: t.Optional(t.String()),
            ctaNoRewardText: t.Optional(t.String()),
            css: t.Optional(t.String()),
        })
    ),
    banner: t.Optional(
        t.Object({
            referralTitle: t.Optional(t.String()),
            referralDescription: t.Optional(t.String()),
            referralCta: t.Optional(t.String()),
            inappTitle: t.Optional(t.String()),
            inappDescription: t.Optional(t.String()),
            inappCta: t.Optional(t.String()),
            css: t.Optional(t.String()),
        })
    ),
});

export const ResolvedPlacementSchema = t.Object({
    components: t.Optional(ResolvedComponentsSchema),
    targetInteraction: t.Optional(t.String()),
    translations: t.Optional(t.Record(t.String(), t.String())),
    css: t.Optional(t.String()),
});
export type ResolvedPlacement = Static<typeof ResolvedPlacementSchema>;

export const ResolvedSdkConfigSchema = t.Object({
    name: t.Optional(t.String()),
    logoUrl: t.Optional(t.String()),
    homepageLink: t.Optional(t.String()),
    currency: t.Optional(
        t.Union([t.Literal("eur"), t.Literal("usd"), t.Literal("gbp")])
    ),
    lang: t.Optional(t.Union([t.Literal("en"), t.Literal("fr")])),
    hidden: t.Optional(t.Boolean()),
    css: t.Optional(t.String()),
    translations: t.Optional(t.Record(t.String(), t.String())),
    placements: t.Optional(t.Record(t.String(), ResolvedPlacementSchema)),
    components: t.Optional(ResolvedComponentsSchema),
    attribution: t.Optional(AttributionDefaultsSchema),
});
export type ResolvedSdkConfig = Static<typeof ResolvedSdkConfigSchema>;

export const MerchantResolveResponseSchema = t.Object({
    merchantId: t.String(),
    productId: t.Hex(),
    name: t.String(),
    domain: t.String(),
    allowedDomains: t.Array(t.String()),
    sdkConfig: t.Optional(ResolvedSdkConfigSchema),
});
export type MerchantResolveResponse = Static<
    typeof MerchantResolveResponseSchema
>;

export const SdkConfigSchema = t.Object({
    name: t.Optional(t.Union([t.String({ maxLength: 200 }), t.Null()])),
    logoUrl: t.Optional(
        t.Union([t.String({ format: "uri", maxLength: 2048 }), t.Null()])
    ),
    homepageLink: t.Optional(
        t.Union([t.String({ format: "uri", maxLength: 2048 }), t.Null()])
    ),
    currency: t.Optional(
        t.Union([
            t.Literal("eur"),
            t.Literal("usd"),
            t.Literal("gbp"),
            t.Null(),
        ])
    ),
    lang: t.Optional(t.Union([t.Literal("fr"), t.Literal("en"), t.Null()])),
    hidden: t.Optional(t.Boolean()),
    rawCss: t.Optional(t.Union([t.String({ maxLength: 50000 }), t.Null()])),
    css: t.Optional(t.Union([t.String({ maxLength: 50000 }), t.Null()])),
    translations: t.Optional(t.Union([TranslationTieredSchema, t.Null()])),
    components: t.Optional(t.Union([PlacementComponentsSchema, t.Null()])),
    placements: t.Optional(
        t.Union([
            t.Record(PlacementIdSchema, PlacementSchema, { maxProperties: 10 }),
            t.Null(),
        ])
    ),
    attribution: t.Optional(t.Union([AttributionDefaultsSchema, t.Null()])),
});
export type SdkConfig = Static<typeof SdkConfigSchema>;
export type Placement = Static<typeof PlacementSchema>;
