import { t } from "@backend-utils";
import type { Static } from "elysia";

/**
 * Merchant configuration schema - SDK and appearance settings
 */
export const MerchantConfigSchema = t.Object({
    sdkConfig: t.Optional(t.Record(t.String(), t.Unknown())),
    appearance: t.Optional(t.Record(t.String(), t.Unknown())),
});
export type MerchantConfig = Static<typeof MerchantConfigSchema>;
