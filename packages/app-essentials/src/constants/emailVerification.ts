/**
 * Constants shared between the backend and the wallet for the email
 * verification + rotation flow. Centralised here so the challenge TTL, the
 * resend debounce and the attempt cap can never drift between the server that
 * enforces them and the client that mirrors them for UX.
 */
export const EMAIL_VERIFICATION = {
    /** Number of characters in a verification code. */
    CODE_LENGTH: 6,
    /** Lifetime of a verification code before it expires. */
    CODE_TTL_MS: 10 * 60_000,
    /** Server-enforced (and client-mirrored) resend debounce window. */
    RESEND_DEBOUNCE_MS: 30_000,
    /** Max wrong guesses against a single code before lockout. */
    MAX_VERIFY_ATTEMPTS: 5,
} as const;
