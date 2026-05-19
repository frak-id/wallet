/**
 * RFC-5322-lite shape used to gate every wallet "email collection" form
 * (onboarding registration step + post-auth `add my email` flow).
 *
 * Strict server-side validation (`t.String({ format: "email" })`) is the
 * source of truth — this only avoids round-tripping obviously broken input
 * through the network, and keeps the "Continue" CTA disabled until the
 * value looks like something the backend will accept.
 */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Whitespace-tolerant validity check. Mirrors the trim() the backend does
 * before storing the address so users typing a stray trailing space don't
 * see the CTA flicker disabled.
 */
export function isValidEmail(value: string): boolean {
    return EMAIL_REGEX.test(value.trim());
}
