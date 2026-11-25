import { roundTo } from "@frak-labs/app-essentials";

const FRAK_COMMISSION_PERCENT = 20;
/** Share of the Target CPA that reaches users (the rest is Frak's commission). */
export const REWARDS_SHARE = 1 - FRAK_COMMISSION_PERCENT / 100;
/** Frak's recommended split of the rewards pool, in favour of the Ambassador. */
const AMBASSADOR_RECO_SHARE = 0.8;
/** Tolerance for the "Ambassador + Referee = pool" validation (rounding). */
const SPLIT_EPSILON = 0.01;

/** Split a Target CPA (EUR or %) into the rewards pool and Frak's commission. */
export function splitTargetCpa(targetCpa: number) {
    const rewardsPool = roundTo(targetCpa * REWARDS_SHARE);
    return { rewardsPool, frakCommission: roundTo(targetCpa - rewardsPool) };
}

/** Reverse of `splitTargetCpa`: the CPA whose rewards pool is this split, to the cent. */
export function recalcCpaFromSplit(ambassador: number, referee: number) {
    return roundTo((ambassador + referee) / REWARDS_SHARE);
}

/** Frak's recommended Ambassador/Referee values for a Target CPA (80/20 of pool). */
export function recommendedSplit(targetCpa: number) {
    const { rewardsPool } = splitTargetCpa(targetCpa);
    // Prefer a whole-number Ambassador share with the Referee taking the
    // remainder, so typical pools land on clean integers (pool 8 → 6 / 2). But
    // for small pools the rounded share can overshoot (pool 0.8 → 1), pushing
    // the Referee negative — there, fall back to a to-the-cent split.
    const whole = Math.round(rewardsPool * AMBASSADOR_RECO_SHARE);
    const ambassador =
        whole > 0 && whole < rewardsPool
            ? whole
            : roundTo(rewardsPool * AMBASSADOR_RECO_SHARE);
    const referee = roundTo(rewardsPool - ambassador);
    return { ambassador, referee };
}

/**
 * When a Target CPA changes, decide the next Ambassador/Referee split. If the
 * current amounts are still the untouched recommendation for the *previous* CPA
 * they track the new CPA (re-recommended); if the user edited them, they stay
 * put (returns `null`, leaving the split for the mismatch warning to flag).
 */
export function recalcSplitOnCpaChange({
    prevCpa,
    nextCpa,
    ambassador,
    referee,
}: {
    prevCpa: number;
    nextCpa: number;
    ambassador: number;
    referee: number;
}): { ambassador: number; referee: number } | null {
    const prevReco = recommendedSplit(prevCpa);
    const isUntouchedReco =
        ambassador > 0 &&
        referee > 0 &&
        ambassador === prevReco.ambassador &&
        referee === prevReco.referee;
    return isUntouchedReco ? recommendedSplit(nextCpa) : null;
}

/** Whether Ambassador + Referee sum to the rewards pool (Frak's 20% aside). */
export function splitMatchesPool(
    targetCpa: number,
    ambassador: number,
    referee: number
) {
    const { rewardsPool } = splitTargetCpa(targetCpa);
    return Math.abs(ambassador + referee - rewardsPool) < SPLIT_EPSILON;
}
