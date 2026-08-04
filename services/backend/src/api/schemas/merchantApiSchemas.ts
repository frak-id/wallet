import { t } from "@backend-utils";
import type { Static } from "elysia";
import {
    ExplorerConfigSchema,
    PlatformSchema,
} from "../../domain/merchant/schemas";

export {
    type MerchantResolveResponse,
    MerchantResolveResponseSchema,
    type ResolvedPlacement,
    type ResolvedSdkConfig,
} from "../../domain/merchant/schemas";

/** Affiliate brand link exposed to the business dashboard (e.g. TakeAds). */
export const AffiliateBrandInfoSchema = t.Object({
    provider: t.Literal("takeads"),
    externalId: t.String(),
    trackingLink: t.String(),
});
export type AffiliateBrandInfo = Static<typeof AffiliateBrandInfoSchema>;

/**
 * A merchant-claimed app, split back out of the stored `platform:packageId`
 * key so clients never have to know the storage encoding.
 */
export const AllowedPackageIdSchema = t.Object({
    platform: PlatformSchema,
    packageId: t.String(),
});
export type AllowedPackageId = Static<typeof AllowedPackageIdSchema>;

/** Request body for the allowed-package-ids add/remove routes. */
export const PackageIdBodySchema = t.Object({
    packageId: t.String({ minLength: 1 }),
    platform: PlatformSchema,
});

export const MerchantDetailResponseSchema = t.Object({
    id: t.String(),
    domain: t.String(),
    allowedDomains: t.Array(t.String()),
    allowedPackageIds: t.Array(AllowedPackageIdSchema),
    name: t.String(),
    // Null for walletless-owned merchants (owner is a business account).
    ownerWallet: t.Union([t.Hex(), t.Null()]),
    bankAddress: t.Union([t.Hex(), t.Null()]),
    defaultRewardToken: t.Hex(),
    explorerConfig: t.Union([ExplorerConfigSchema, t.Null()]),
    explorerEnabledAt: t.Union([t.String(), t.Null()]),
    verifiedAt: t.Union([t.String(), t.Null()]),
    createdAt: t.Union([t.String(), t.Null()]),
    role: t.Union([
        t.Literal("owner"),
        t.Literal("admin"),
        t.Literal("platform_admin"),
        t.Literal("none"),
    ]),
    affiliate: t.Union([AffiliateBrandInfoSchema, t.Null()]),
});
export type MerchantDetailResponse = Static<
    typeof MerchantDetailResponseSchema
>;

const MerchantSummarySchema = t.Object({
    id: t.String(),
    domain: t.String(),
    name: t.String(),
    isAffiliate: t.Optional(t.Boolean()),
});

export const MyMerchantsResponseSchema = t.Object({
    owned: t.Array(MerchantSummarySchema),
    adminOf: t.Array(MerchantSummarySchema),
    isPlatformAdmin: t.Boolean(),
    allMerchants: t.Optional(t.Array(MerchantSummarySchema)),
});
export type MyMerchantsResponse = Static<typeof MyMerchantsResponseSchema>;
