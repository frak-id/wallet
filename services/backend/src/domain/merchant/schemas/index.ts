import { t } from "@backend-utils";
import type { Static } from "elysia";

export const ExplorerConfigSchema = t.Object({
    heroImageUrl: t.Optional(t.String({ format: "uri", maxLength: 2048 })),
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

const ButtonShareComponentSchema = t.Object({
    text: t.Optional(t.String({ maxLength: 500 })),
    noRewardText: t.Optional(t.String({ maxLength: 500 })),
    clickAction: t.Optional(
        t.Union([
            t.Literal("embedded-wallet"),
            t.Literal("share-modal"),
            t.Literal("sharing-page"),
        ])
    ),
    useReward: t.Optional(t.Boolean()),
    rawCss: t.Optional(t.String({ maxLength: 50000 })),
    css: t.Optional(t.String({ maxLength: 50000 })),
});

const ButtonWalletComponentSchema = t.Object({
    position: t.Optional(
        t.Union([t.Literal("bottom-right"), t.Literal("bottom-left")])
    ),
    rawCss: t.Optional(t.String({ maxLength: 50000 })),
    css: t.Optional(t.String({ maxLength: 50000 })),
});

const OpenInAppComponentSchema = t.Object({
    text: t.Optional(t.String({ maxLength: 500 })),
    rawCss: t.Optional(t.String({ maxLength: 50000 })),
    css: t.Optional(t.String({ maxLength: 50000 })),
});

const PlacementComponentsSchema = t.Object({
    buttonShare: t.Optional(ButtonShareComponentSchema),
    buttonWallet: t.Optional(ButtonWalletComponentSchema),
    openInApp: t.Optional(OpenInAppComponentSchema),
});

export const PlacementSchema = t.Object({
    components: t.Optional(PlacementComponentsSchema),
    targetInteraction: t.Optional(t.String({ maxLength: 200 })),
    translations: t.Optional(TranslationTieredSchema),
    rawCss: t.Optional(t.String({ maxLength: 50000 })),
    css: t.Optional(t.String({ maxLength: 50000 })),
});

const PlacementIdSchema = t.String({ pattern: "^[a-zA-Z0-9_-]{3,16}$" });

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
    placements: t.Optional(
        t.Union([
            t.Record(PlacementIdSchema, PlacementSchema, { maxProperties: 10 }),
            t.Null(),
        ])
    ),
});
export type SdkConfig = Static<typeof SdkConfigSchema>;
export type Placement = Static<typeof PlacementSchema>;
