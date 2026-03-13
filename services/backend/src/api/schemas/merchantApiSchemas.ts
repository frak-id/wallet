import { t } from "@backend-utils";
import type { Static } from "elysia";
import { MerchantAppearanceSchema } from "../../domain/merchant/schemas";

export const MerchantDetailResponseSchema = t.Object({
    id: t.String(),
    domain: t.String(),
    name: t.String(),
    ownerWallet: t.Hex(),
    bankAddress: t.Union([t.Hex(), t.Null()]),
    defaultRewardToken: t.Hex(),
    config: t.Union([t.Object({}), t.Null()]),
    appearance: t.Union([MerchantAppearanceSchema, t.Null()]),
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
