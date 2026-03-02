import { t } from "@backend-utils";

/**
 * JWT payload for anonymous identity merge tokens
 * Used to securely merge anonymous identity groups across browser contexts
 * (e.g., Instagram browser -> native browser)
 */
export const AnonymousMergeTokenDto = t.Object({
    // Source identity group ID
    sourceGroupId: t.String({ format: "uuid" }),
    // Merchant context where source anonymous ID exists
    sourceMerchantId: t.String({ format: "uuid" }),
    // Source anonymous fingerprint value (for logging/debug)
    sourceAnonymousId: t.String(),
});
