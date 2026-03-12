import { t } from "@backend-utils";
import type { Static } from "elysia";

export const MerchantAppearanceSchema = t.Object({
    heroImageUrl: t.Optional(t.String()),
    description: t.Optional(t.String()),
});
export type MerchantAppearance = Static<typeof MerchantAppearanceSchema>;

/**
 * Merchant configuration schema - SDK and appearance settings
 */
export const MerchantConfigSchema = t.Object({
    sdkConfig: t.Optional(t.Record(t.String(), t.Unknown())),
    appearance: t.Optional(MerchantAppearanceSchema),
});
export type MerchantConfig = Static<typeof MerchantConfigSchema>;
