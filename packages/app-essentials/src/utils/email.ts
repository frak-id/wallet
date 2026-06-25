/**
 * Lightweight email-shape validation shared across apps.
 *
 * RFC-5322-lite: `local@domain.tld`, no whitespace, a dotted domain. This is a
 * client-side convenience gate only — strict validation (`t.String({ format:
 * "email" })`) remains the server's source of truth. It exists to keep "submit"
 * CTAs disabled until input looks like something the backend will accept.
 */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Whitespace-tolerant validity check. Mirrors the `trim()` the backend does
 * before storing, so a stray trailing space doesn't flicker a CTA disabled.
 */
export function isValidEmail(value: string): boolean {
    return EMAIL_REGEX.test(value.trim());
}
