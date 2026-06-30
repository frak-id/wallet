import { roundTo } from "@frak-labs/app-essentials";
import {
    type CampaignDraft,
    getChaining,
    setChaining,
} from "@/stores/campaignStore";
import type { RewardChaining } from "@/types/Campaign";

export type ReferralChainFormValues = {
    /** Whether multi-level chained rewards are enabled (the toggle). */
    enabled: boolean;
    /** % each deeper level loses; backend `chaining.deperditionPerLevel`. */
    deperditionPerLevel: number | "";
    /** Max rewarded levels; backend `chaining.maxDepth`. `""` = unlimited. */
    maxDepth: number | "";
};

/** Default decrease per level; below `MIN_DEPERDITION_PER_LEVEL` the model breaks. */
export const DEFAULT_DEPERDITION_PER_LEVEL = 80;

/** Default number of rewarded levels. */
export const DEFAULT_MAX_DEPTH = 5;

/** Floor on the per-level decrease: below 50% deeper levels collectively
 * out-earn the direct referrer and the distribution model no longer holds. */
export const MIN_DEPERDITION_PER_LEVEL = 50;

export const DEFAULT_REFERRAL_CHAIN_FORM: ReferralChainFormValues = {
    enabled: false,
    deperditionPerLevel: DEFAULT_DEPERDITION_PER_LEVEL,
    maxDepth: DEFAULT_MAX_DEPTH,
};

/** Backend fallback depth when `maxDepth` is unset; preview assumes it. */
export const DEFAULT_PREVIEW_DEPTH = DEFAULT_MAX_DEPTH;

/** Frontend cap on rewarded levels (the backend imposes none). */
export const MAX_REWARDED_LEVELS = 20;

/** Chaining only attaches to a referrer reward. */
export function hasReferrerReward(draft: CampaignDraft): boolean {
    return draft.rule.rewards.some((r) => r.recipient === "referrer");
}

export function draftToReferralChainForm(
    draft: CampaignDraft
): ReferralChainFormValues {
    const chaining = getChaining(draft.rule);
    if (!chaining) return { ...DEFAULT_REFERRAL_CHAIN_FORM };
    return {
        enabled: true,
        deperditionPerLevel: chaining.deperditionPerLevel,
        maxDepth: chaining.maxDepth ?? "",
    };
}

export function referralChainFormToDraft(
    values: ReferralChainFormValues,
    draft: CampaignDraft
): CampaignDraft {
    if (!values.enabled) {
        return { ...draft, rule: setChaining(draft.rule, undefined) };
    }
    const chaining: RewardChaining = {
        deperditionPerLevel: Number(values.deperditionPerLevel) || 0,
        // Empty = unlimited: omit `maxDepth` rather than send 0.
        ...(values.maxDepth === ""
            ? {}
            : { maxDepth: Number(values.maxDepth) }),
    };
    return { ...draft, rule: setChaining(draft.rule, chaining) };
}

/** Continue gating: OFF always valid; ON needs decrease in [50,100), a valid
 * max level, and a referrer reward. */
export function isReferralChainFormValid(
    values: ReferralChainFormValues,
    draft: CampaignDraft
): boolean {
    if (!values.enabled) return true;
    const decrease = Number(values.deperditionPerLevel);
    const decreaseOk = decrease >= MIN_DEPERDITION_PER_LEVEL && decrease < 100;
    const depth = Number(values.maxDepth);
    const depthOk =
        values.maxDepth === "" ||
        (Number.isInteger(depth) && depth >= 1 && depth <= MAX_REWARDED_LEVELS);
    return decreaseOk && depthOk && hasReferrerReward(draft);
}

export type ChainPreviewRow = {
    /** 0 = direct referrer, then level 1, 2 … (depth-ascending). */
    level: number;
    /** € amount this member receives (rounded for display). */
    amount: number;
    /** Share of the base reward, 0–100. */
    share: number;
};

/** Mirrors backend `distributeChainedRewards`: split `base` across the chain
 * (each non-last takes `deperditionPerLevel`%, deepest takes the rest; sum = base). */
export function computeChainPreview(
    base: number,
    deperditionPerLevel: number,
    depth: number
): ChainPreviewRow[] {
    const f = deperditionPerLevel / 100;
    const n = Math.max(1, Math.floor(depth));
    const rows: ChainPreviewRow[] = [];
    let remaining = base;
    let remainingShare = 1;
    let roundedAmount = 0;
    let roundedShare = 0;
    for (let i = 0; i < n; i++) {
        if (i === n - 1) {
            // Last row absorbs the rounding residual so the rounded amounts sum
            // back to `base` and the shares to 100.
            rows.push({
                level: i,
                amount: roundTo(base - roundedAmount),
                share: roundTo(100 - roundedShare),
            });
            break;
        }
        const amount = roundTo(remaining * f);
        const share = roundTo(remainingShare * f * 100);
        remaining -= remaining * f;
        remainingShare -= remainingShare * f;
        roundedAmount = roundTo(roundedAmount + amount);
        roundedShare = roundTo(roundedShare + share);
        rows.push({ level: i, amount, share });
    }
    return rows;
}
