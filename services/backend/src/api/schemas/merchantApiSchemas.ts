import { t } from "@backend-utils";
import type { Static } from "elysia";
import { ExplorerConfigSchema } from "../../domain/merchant/schemas";

const ResolvedPlacementSchema = t.Object({
    components: t.Optional(
        t.Object({
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
                    useReward: t.Optional(t.Boolean()),
                    css: t.Optional(t.String()),
                })
            ),
            buttonWallet: t.Optional(
                t.Object({
                    position: t.Optional(
                        t.Union([
                            t.Literal("bottom-right"),
                            t.Literal("bottom-left"),
                        ])
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
        })
    ),
    targetInteraction: t.Optional(t.String()),
    translations: t.Optional(t.Record(t.String(), t.String())),
    css: t.Optional(t.String()),
});

const ResolvedSdkConfigSchema = t.Object({
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
});

export type ResolvedPlacement = Static<typeof ResolvedPlacementSchema>;
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

export const MerchantDetailResponseSchema = t.Object({
    id: t.String(),
    domain: t.String(),
    name: t.String(),
    ownerWallet: t.Hex(),
    bankAddress: t.Union([t.Hex(), t.Null()]),
    defaultRewardToken: t.Hex(),
    explorerConfig: t.Union([ExplorerConfigSchema, t.Null()]),
    explorerEnabledAt: t.Union([t.String(), t.Null()]),
    verifiedAt: t.Union([t.String(), t.Null()]),
    createdAt: t.Union([t.String(), t.Null()]),
    role: t.Union([t.Literal("owner"), t.Literal("admin"), t.Literal("none")]),
});
export type MerchantDetailResponse = Static<
    typeof MerchantDetailResponseSchema
>;

const MerchantSummarySchema = t.Object({
    id: t.String(),
    domain: t.String(),
    name: t.String(),
});

export const MyMerchantsResponseSchema = t.Object({
    owned: t.Array(MerchantSummarySchema),
    adminOf: t.Array(MerchantSummarySchema),
});
export type MyMerchantsResponse = Static<typeof MyMerchantsResponseSchema>;
