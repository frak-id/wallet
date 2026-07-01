import { customAlphabet } from "nanoid";

/**
 * Opaque attribution token (the provider sub-id) Frak mints per (provider,
 * user, brand). It is appended to a tracking link as a query-param value, so
 * the alphabet is restricted to URL-safe, unambiguous characters. 24 chars over
 * a 62-symbol alphabet (~1.4e43 space) makes collisions statistically
 * irrelevant; the `(provider, identityGroupId, merchantId)` unique index is the
 * actual guarantee against duplicates.
 */
const TOKEN_ALPHABET =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const TOKEN_LENGTH = 24;

export const generateAffiliateToken = customAlphabet(
    TOKEN_ALPHABET,
    TOKEN_LENGTH
);
