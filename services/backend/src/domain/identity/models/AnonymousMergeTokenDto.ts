import { t } from "@backend-utils";

/**
 * JWT payload for identity merge tokens.
 *
 * Used to securely merge identity groups across browser contexts. Two flows:
 *  - Anonymous → anonymous: Instagram in-app browser → native browser
 *    (source is an anonymous fingerprint scoped to a merchant).
 *  - Wallet → anonymous: wallet app explorer → merchant website
 *    (source is the authenticated wallet's identity group; no anon id).
 */
export const AnonymousMergeTokenDto = t.Object({
    // Source identity group ID — this is the authoritative claim. Every
    // other `source*` field is purely for traceability when decoding the
    // JWT out of band (logs, debug dashboards).
    sourceGroupId: t.String({ format: "uuid" }),
    // Merchant context this token is bound to
    sourceMerchantId: t.String({ format: "uuid" }),
    // Source anonymous fingerprint value (logging only). Present when the
    // token originates from an anonymous SDK session.
    sourceAnonymousId: t.Optional(t.String()),
    // Source wallet address (logging only). Present when the token
    // originates from a wallet-authenticated session.
    sourceWalletAddress: t.Optional(t.Address()),
});
