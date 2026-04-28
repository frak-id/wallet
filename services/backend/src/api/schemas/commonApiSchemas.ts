import { t } from "@backend-utils";
import type { Static } from "elysia";

/**
 * Common param schema for merchant-scoped endpoints
 */
export const MerchantIdParamSchema = t.Object({
    merchantId: t.String(),
});
export type MerchantIdParam = Static<typeof MerchantIdParamSchema>;

/**
 * Common param schema for campaign-scoped endpoints under a merchant
 */
export const MerchantCampaignParamSchema = t.Object({
    merchantId: t.String(),
    campaignId: t.String(),
});
export type MerchantCampaignParam = Static<typeof MerchantCampaignParamSchema>;

/**
 * Common header schema for frak client identification
 */
export const FrakClientIdHeaderSchema = t.Object({
    "x-frak-client-id": t.Optional(t.String()),
});
export type FrakClientIdHeader = Static<typeof FrakClientIdHeaderSchema>;
