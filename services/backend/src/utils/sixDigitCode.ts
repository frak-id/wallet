import { customAlphabet } from "nanoid";

/**
 * Shared 6-digit code primitive used by install codes and referral codes.
 *
 * The alphabet excludes ambiguous characters (0/O, 1/I/L) to keep codes easy
 * to dictate and type. 29^6 ≈ 594M possible values.
 *
 * Both repositories batch a set of candidates and rely on
 * `WHERE NOT EXISTS … ON CONFLICT DO NOTHING` to pick the first free code in
 * a single round-trip, which makes collisions statistically irrelevant in
 * practice.
 */
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 6;
export const CANDIDATE_BATCH_SIZE = 50;

export const generateCode = customAlphabet(CODE_ALPHABET, CODE_LENGTH);

export function generateCandidates(count = CANDIDATE_BATCH_SIZE): string[] {
    return Array.from({ length: count }, () => generateCode());
}
