import { log } from "@backend-infrastructure";
import {
    CODE_ALPHABET,
    CODE_DIGIT_ALPHABET,
    CODE_LENGTH,
    STEM_ALPHABET
} from "@backend-utils";
import type { ReferralCodeSelect } from "../db/schema";
import type { ReferralCodeRepository } from "../repositories/ReferralCodeRepository";

type IssueErrorCode =
    | "ALREADY_ACTIVE"
    | "INVALID_CODE_LENGTH"
    | "INVALID_CODE_CHARS"
    | "CODE_UNAVAILABLE";

type IssueResult =
    | { success: true; code: ReferralCodeSelect }
    | { success: false; error: string; code: IssueErrorCode };

type SuggestResult =
    | { success: true; suggestions: string[] }
    | {
          success: false;
          error: string;
          code: "INVALID_STEM_LENGTH" | "INVALID_STEM_CHARS";
      };

// User may only supply 3- or 4-char stems. Anything shorter leaks too
// little personalisation; anything longer leaves too small a fill space
// (and `5` only gives 1 random char, which is just "pick a digit for me").
const ALLOWED_STEM_LENGTHS: ReadonlySet<number> = new Set([3, 4]);

const DEFAULT_SUGGEST_COUNT = 10;
const MAX_SUGGEST_COUNT = 20;

// Pool size per preference tier — at 3x the requested count we keep
// enough candidates to absorb the availability filter without exploding
// the namespace probe.
const POOL_MULTIPLIER = 3;

export class ReferralCodeService {
    constructor(
        private readonly referralCodeRepository: ReferralCodeRepository
    ) {}

    /**
     * Issue a new active code for the owner. Two modes:
     *
     *  - **Random**: caller omits `preferredCode`; server generates a batch
     *    and picks the first free one.
     *  - **Specific claim**: caller passes `preferredCode` (typically one
     *    selected from `/code/suggest`). Server either claims it or fails
     *    with `CODE_UNAVAILABLE` — no fallback to random, so the UI can ask
     *    the user to pick another.
     *
     * Always fails with `ALREADY_ACTIVE` if the owner already has an active
     * code; the owner must `revoke` first.
     */
    async issue(params: {
        ownerIdentityGroupId: string;
        preferredCode?: string;
    }): Promise<IssueResult> {
        const existing = await this.referralCodeRepository.findActiveByOwner(
            params.ownerIdentityGroupId
        );
        if (existing) {
            return {
                success: false,
                error: "An active referral code already exists for this user",
                code: "ALREADY_ACTIVE",
            };
        }

        const preferredCode = params.preferredCode?.toUpperCase();
        if (preferredCode !== undefined) {
            if (preferredCode.length !== CODE_LENGTH) {
                return {
                    success: false,
                    error: `code must be exactly ${CODE_LENGTH} characters`,
                    code: "INVALID_CODE_LENGTH",
                };
            }
            for (const ch of preferredCode) {
                if (!CODE_ALPHABET.includes(ch)) {
                    return {
                        success: false,
                        error: `code contains invalid character: ${ch}`,
                        code: "INVALID_CODE_CHARS",
                    };
                }
            }
        }

        const created = await this.referralCodeRepository.create({
            ownerIdentityGroupId: params.ownerIdentityGroupId,
            candidates: preferredCode ? [preferredCode] : undefined,
        });
        if (!created) {
            if (preferredCode) {
                return {
                    success: false,
                    error: "Requested code is not available",
                    code: "CODE_UNAVAILABLE",
                };
            }
            // Random mode with 50 candidates against 887M namespace — this
            // branch is statistically unreachable outside of a compromised
            // RNG or catastrophic DB state.
            throw new Error(
                "Failed to issue referral code: no free candidate among the generated batch"
            );
        }

        log.info(
            {
                ownerIdentityGroupId: params.ownerIdentityGroupId,
                code: created.code,
                mode: preferredCode ? "claim" : "random",
            },
            "Referral code issued"
        );

        return { success: true, code: created };
    }

    /**
     * Revoke the active code without replacement. No-op if the owner has no
     * active code.
     */
    async revoke(params: { ownerIdentityGroupId: string }): Promise<void> {
        const revoked = await this.referralCodeRepository.revokeActiveByOwner(
            params.ownerIdentityGroupId
        );
        if (revoked) {
            log.info(
                {
                    ownerIdentityGroupId: params.ownerIdentityGroupId,
                    codeId: revoked.id,
                },
                "Referral code revoked"
            );
        }
    }

    async findActiveByOwner(
        ownerIdentityGroupId: string
    ): Promise<ReferralCodeSelect | null> {
        return this.referralCodeRepository.findActiveByOwner(
            ownerIdentityGroupId
        );
    }

    async findByCode(code: string): Promise<ReferralCodeSelect | null> {
        return this.referralCodeRepository.findByCode(code);
    }

    /**
     * Suggest available referral codes containing the user's stem. Fill
     * characters are appended at the start or the end of the stem only —
     * middle insertion is not considered.
     *
     * Digits are preferred for the fill (easier to read / type); letters
     * are only used as a fallback when the digit namespace doesn't yield
     * enough available candidates. Order in the returned array preserves
     * that preference.
     */
    async suggestWithStem(params: {
        stem: string;
        count?: number;
    }): Promise<SuggestResult> {
        const stem = params.stem.toUpperCase();

        if (!ALLOWED_STEM_LENGTHS.has(stem.length)) {
            return {
                success: false,
                error: "stem must be exactly 3 or 4 characters",
                code: "INVALID_STEM_LENGTH",
            };
        }
        for (const ch of stem) {
            if (!STEM_ALPHABET.includes(ch)) {
                return {
                    success: false,
                    error: `stem contains invalid character: ${ch}`,
                    code: "INVALID_STEM_CHARS",
                };
            }
        }

        const count = Math.min(
            Math.max(params.count ?? DEFAULT_SUGGEST_COUNT, 1),
            MAX_SUGGEST_COUNT
        );
        const fillLen = CODE_LENGTH - stem.length;

        // Digit-first pool (preferred). Full-alphabet pool second — kicks in
        // only when the digit-only pool doesn't produce enough available
        // candidates after the availability filter.
        const digitPool = sampleStemCandidates(
            stem,
            fillLen,
            CODE_DIGIT_ALPHABET,
            count * POOL_MULTIPLIER
        );
        const fallbackPool = sampleStemCandidates(
            stem,
            fillLen,
            CODE_ALPHABET,
            count * POOL_MULTIPLIER
        );

        // Preserve order: digits first, fallback after. Set dedupes across
        // pools while keeping first-seen ordering.
        const pool = [...new Set([...digitPool, ...fallbackPool])];

        const suggestions =
            await this.referralCodeRepository.filterAvailableCandidates(pool);

        log.debug(
            {
                stemLength: stem.length,
                poolSize: pool.length,
                returned: Math.min(suggestions.length, count),
            },
            "Referral code suggestions generated"
        );

        return {
            success: true,
            suggestions: suggestions.slice(0, count),
        };
    }
}

/**
 * Draw up to `targetCount` unique candidates by placing random fill chars
 * from `alphabet` either immediately before or immediately after the stem.
 * `Math.random` is fine — this is UX suggestion, not a security primitive.
 */
function sampleStemCandidates(
    stem: string,
    fillLen: number,
    alphabet: string,
    targetCount: number
): string[] {
    const seen = new Set<string>();
    const maxAttempts = targetCount * 4;
    for (let i = 0; seen.size < targetCount && i < maxAttempts; i++) {
        let fill = "";
        for (let j = 0; j < fillLen; j++) {
            fill += alphabet[Math.floor(Math.random() * alphabet.length)];
        }
        const atStart = Math.random() < 0.5;
        seen.add(atStart ? `${fill}${stem}` : `${stem}${fill}`);
    }
    return [...seen];
}
