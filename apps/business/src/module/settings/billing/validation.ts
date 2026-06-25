/**
 * Billing form validation rules. Kept here (rather than inline) so the email
 * pattern is unit-testable and reused across add/edit.
 */

/** Pragmatic email shape: `local@domain.tld`, no whitespace, a dotted domain. */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
