/**
 * Dependency-free LEAF module on purpose: `src/index.ts` needs this value for
 * CORS `exposeHeaders`, and reaching it through the `@backend-infrastructure`
 * barrel creates a runtime cycle (entry → barrel → macro/session →
 * external/jwt) that degrades `JwtContext.wallet.verify` to the untyped JWT
 * fallback. Import via the `macro/authError` sub-path, never the barrel.
 */
export const AUTH_ERROR_HEADER = "x-frak-auth-error";

/**
 * Companion to `AUTH_ERROR_HEADER` for a `step-up-required` 401: the offered
 * 2FA methods as a comma-separated list (e.g. `email,totp`), so the frontend
 * classifies a step-up from headers alone. Must be CORS-exposed.
 */
export const AUTH_METHODS_HEADER = "x-frak-auth-methods";

export const AuthErrorCode = {
    walletTokenInvalid: "wallet-token-invalid",
    sdkTokenInvalid: "sdk-token-invalid",
} as const;
