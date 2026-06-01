import type { Hex } from "viem";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
    BudgetConfigItem,
    CampaignMetadata,
    CampaignRuleDefinition,
    ConditionGroup,
    RuleCondition,
    RuleConditions,
} from "@/types/Campaign";

/**
 * Local draft for the creation wizard. Mirrors the backend create/update body
 * 1:1 — `buildApiPayload` is a near-identity pass — so there is no parallel
 * DTO to keep in sync. The UI toggles that map to rule conditions
 * (referral-only, minimum purchase, start date) live inside `rule.conditions`
 * and are read/written through the helpers below.
 */
export type CampaignDraft = {
    id?: string;
    merchantId: string;
    name: string;
    /**
     * UI-only pending currency selection. Applied onto `rule.rewards[].token`
     * when the reward step builds the rewards; never sent on its own. Left
     * undefined → the backend fills the merchant default at create time.
     */
    rewardToken?: Hex;
    rule: CampaignRuleDefinition;
    metadata: CampaignMetadata;
    budgetConfig: BudgetConfigItem[];
    /** ISO-8601 campaign end — sent verbatim as the backend's `expiresAt`. */
    expiresAt?: string;
    priority: number;
};

const TIME_FIELD = "time.timestamp";
const REFERRAL_FIELD = "attribution.referrerIdentityGroupId";
const MIN_PURCHASE_FIELD = "purchase.amount";

const REFERRAL_CONDITION: RuleCondition = {
    field: REFERRAL_FIELD,
    operator: "exists",
    value: true,
};

const initialDraft: CampaignDraft = {
    merchantId: "",
    name: "",
    rule: {
        trigger: "purchase",
        // Referral-only is the default — encoded as the condition itself, so
        // the draft already matches what the backend stores.
        conditions: [REFERRAL_CONDITION],
        rewards: [],
    },
    metadata: {
        goal: undefined,
        specialCategories: [],
        territories: [],
    },
    budgetConfig: [],
    priority: 0,
};

type CampaignState = {
    draft: CampaignDraft;
    isSuccess: boolean;

    setDraft: (draft: CampaignDraft) => void;
    updateDraft: (fn: (d: CampaignDraft) => CampaignDraft) => void;
    setSuccess: (v: boolean) => void;
    reset: () => void;
};

export const campaignStore = create<CampaignState>()(
    persist(
        (set) => ({
            draft: initialDraft,
            isSuccess: false,

            setDraft: (draft) => set({ draft }),
            updateDraft: (fn) => set((s) => ({ draft: fn(s.draft) })),
            setSuccess: (isSuccess) => set({ isSuccess }),
            reset: () => set({ draft: initialDraft, isSuccess: false }),
        }),
        {
            // v5: draft shape tightened to match the backend (scheduled /
            // referralOnly / minPurchaseAmount folded into rule.conditions).
            name: "campaign-draft-v5",
            partialize: (s) => ({ draft: s.draft }),
        }
    )
);

/* ------------------------------------------------------------------ */
/*  Rule-condition helpers                                            */
/*                                                                    */
/*  These are the single source of truth for the form toggles that    */
/*  are stored as conditions. They operate on the flat, top-level     */
/*  condition list; a grouped rule (`ConditionGroup`) is read         */
/*  best-effort and its nested groups are preserved untouched on      */
/*  write (no UI produces groups today).                              */
/* ------------------------------------------------------------------ */

function dateToTimestamp(date: string): number {
    return Math.floor(new Date(date).getTime() / 1000);
}

function topLevelConditions(conditions: RuleConditions): {
    list: RuleCondition[];
    rebuild: (next: RuleCondition[]) => RuleConditions;
} {
    if (Array.isArray(conditions)) {
        return { list: conditions, rebuild: (next) => next };
    }
    const list: RuleCondition[] = [];
    const nested: ConditionGroup[] = [];
    for (const c of conditions.conditions) {
        if ("field" in c) list.push(c);
        else nested.push(c);
    }
    return {
        list,
        rebuild: (next) => ({
            ...conditions,
            conditions: [...next, ...nested],
        }),
    };
}

function setCondition(
    rule: CampaignRuleDefinition,
    match: (c: RuleCondition) => boolean,
    next: RuleCondition | null
): CampaignRuleDefinition {
    const { list, rebuild } = topLevelConditions(rule.conditions);
    const without = list.filter((c) => !match(c));
    const updated = next ? [...without, next] : without;
    return { ...rule, conditions: rebuild(updated) };
}

export function getReferralOnly(rule: CampaignRuleDefinition): boolean {
    return topLevelConditions(rule.conditions).list.some(
        (c) => c.field === REFERRAL_FIELD && c.operator === "exists"
    );
}

export function setReferralOnly(
    rule: CampaignRuleDefinition,
    enabled: boolean
): CampaignRuleDefinition {
    return setCondition(
        rule,
        (c) => c.field === REFERRAL_FIELD,
        enabled ? REFERRAL_CONDITION : null
    );
}

export function getMinPurchaseAmount(rule: CampaignRuleDefinition): number {
    const found = topLevelConditions(rule.conditions).list.find(
        (c) => c.field === MIN_PURCHASE_FIELD && c.operator === "gte"
    );
    return typeof found?.value === "number" ? found.value : 0;
}

export function setMinPurchaseAmount(
    rule: CampaignRuleDefinition,
    amount: number
): CampaignRuleDefinition {
    return setCondition(
        rule,
        (c) => c.field === MIN_PURCHASE_FIELD && c.operator === "gte",
        amount > 0
            ? { field: MIN_PURCHASE_FIELD, operator: "gte", value: amount }
            : null
    );
}

export function getStartDate(rule: CampaignRuleDefinition): string | undefined {
    const found = topLevelConditions(rule.conditions).list.find(
        (c) => c.field === TIME_FIELD && c.operator === "gte"
    );
    return typeof found?.value === "number"
        ? new Date(found.value * 1000).toISOString()
        : undefined;
}

export function setStartDate(
    rule: CampaignRuleDefinition,
    date: string | undefined
): CampaignRuleDefinition {
    return setCondition(
        rule,
        (c) => c.field === TIME_FIELD && c.operator === "gte",
        date
            ? {
                  field: TIME_FIELD,
                  operator: "gte",
                  value: dateToTimestamp(date),
              }
            : null
    );
}

/**
 * Draft → create/update body. Near-identity: the draft already holds the
 * backend shape (conditions, expiresAt). `rewardToken` is intentionally not
 * sent — it is applied onto `rule.rewards` by the reward step, and the
 * backend resolves the merchant default for any reward left without a token.
 */
export function buildApiPayload(draft: CampaignDraft) {
    return {
        merchantId: draft.merchantId,
        name: draft.name,
        rule: draft.rule,
        metadata: draft.metadata,
        budgetConfig: draft.budgetConfig,
        expiresAt: draft.expiresAt,
        priority: draft.priority,
    };
}

/** Backend campaign → draft. Reward token is derived from the rewards. */
export function campaignToDraft(campaign: {
    id: string;
    merchantId: string;
    name: string;
    rule: CampaignRuleDefinition;
    metadata?: CampaignMetadata | null;
    budgetConfig?: BudgetConfigItem[] | null;
    expiresAt?: string | null;
    priority: number;
}): CampaignDraft {
    const rewardToken = campaign.rule.rewards.find((r) => r.token)?.token as
        | Hex
        | undefined;

    return {
        id: campaign.id,
        merchantId: campaign.merchantId,
        name: campaign.name,
        rewardToken,
        rule: campaign.rule,
        metadata: campaign.metadata ?? {
            goal: undefined,
            specialCategories: [],
            territories: [],
        },
        budgetConfig: campaign.budgetConfig ?? [],
        expiresAt: campaign.expiresAt ?? undefined,
        priority: campaign.priority,
    };
}
