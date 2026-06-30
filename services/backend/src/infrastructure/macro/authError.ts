/**
 * Auth-error discriminator constants.
 *
 * IMPORTANT: this is a dependency-free LEAF module on purpose. The app entry
 * (`src/index.ts`) needs `AUTH_ERROR_HEADER` for its CORS `exposeHeaders`, and
 * importing a *value* into the entry through the `@backend-infrastructure`
 * barrel introduces a runtime import cycle (entry → barrel → macro/session →
 * external/jwt) that silently degrades `JwtContext.wallet.verify`'s typed
 * return to the generic JWT fallback. Keeping these here (imported via the
 * `@backend-infrastructure/macro/authError` sub-path, never the barrel) means
 * no consumer can re-create that cycle.
 *
 * Tagged onto a 401 as the `x-frak-auth-error` response header so the wallet
 * client can tell which credential failed:
 *  - `wallet-token-invalid` → the wallet session is dead (missing / expired /
 *    revoked / secret-rotated). The client surfaces a re-auth prompt.
 *  - `sdk-token-invalid`    → only the short-lived SDK token failed; the wallet
 *    session is fine. The client silently re-mints and must NOT force re-auth.
 *
 * Must be CORS-exposed (see `exposeHeaders` in index.ts) to be readable from
 * the cross-origin iframe contexts the wallet runs in.
 */
export const AUTH_ERROR_HEADER = "x-frak-auth-error";

export const AuthErrorCode = {
    walletTokenInvalid: "wallet-token-invalid",
    sdkTokenInvalid: "sdk-token-invalid",
} as const;
