import { NEGATIVE_OPERATORS } from "@frak-labs/core-sdk/rewards";
import type { Address, Hex } from "viem";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
    BudgetConfigItem,
    CampaignMetadata,
    CampaignRuleDefinition,
    ConditionGroup,
    RewardChaining,
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
            // v6: rewardToken now means "explicit non-default currency" — a
            // token equal to the merchant default is dropped on hydration.
            // Bump invalidates pre-fix drafts that baked the default in.
            name: "campaign-draft-v6",
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

/**
 * Chained-referral config lives on each `referrer` reward (the backend reads
 * it there). These helpers keep all referrer rewards in sync.
 */
export function getChaining(
    rule: CampaignRuleDefinition
): RewardChaining | undefined {
    return rule.rewards.find((r) => r.recipient === "referrer")?.chaining;
}

export function setChaining(
    rule: CampaignRuleDefinition,
    chaining: RewardChaining | undefined
): CampaignRuleDefinition {
    return {
        ...rule,
        rewards: rule.rewards.map((reward) => {
            if (reward.recipient !== "referrer") return reward;
            if (!chaining) {
                const { chaining: _dropped, ...rest } = reward;
                return rest;
            }
            return { ...reward, chaining };
        }),
    };
}

/* ------------------------------------------------------------------ */
/*  Product scope                                                     */
/*                                                                    */
/*  `rule.productScope` gates a purchase campaign on cart contents,   */
/*  evaluated per line item (root fields, no `purchase.` prefix). The */
/*  wizard authors a single flat condition — the schema allows nested */
/*  groups, so a scope the UI can't represent is read as "advanced"   */
/*  and preserved untouched rather than flattened.                    */
/* ------------------------------------------------------------------ */

/** Backend `PRODUCT_SCOPE_FIELDS` allowlist (CampaignManagementService.ts:25). */
export const PRODUCT_SCOPE_FIELDS = [
    "productId",
    "name",
    "sku",
    "quantity",
    "unitPrice",
    "totalPrice",
] as const;

export type ProductScopeField = (typeof PRODUCT_SCOPE_FIELDS)[number];

/**
 * The single condition the wizard edits, when the scope is shaped like one.
 * `undefined` means either no scope, or a scope too complex for the form.
 */
export function getProductScopeCondition(
    rule: CampaignRuleDefinition
): RuleCondition | undefined {
    const scope = rule.productScope;
    if (!scope) return undefined;
    // Only a flat array is editable. Unwrapping a group would drop its
    // `logic`, and `none` inverts the whole scope — a single-condition
    // `none` group would read as its own opposite and be saved back
    // positively, silently reversing which products the campaign covers.
    if (!Array.isArray(scope)) return undefined;
    if (scope.length !== 1) return undefined;
    const [only] = scope;
    return only && "field" in only ? only : undefined;
}

export function setProductScope(
    rule: CampaignRuleDefinition,
    condition: RuleCondition | null
): CampaignRuleDefinition {
    if (!condition) {
        const { productScope: _dropped, ...rest } = rule;
        return rest;
    }
    return { ...rule, productScope: [condition] };
}

/**
 * Whether the scope selects a complement set. Mirrors the backend's
 * `productScopeHasNegation`, including its conservative `logic: "none"` rule;
 * both read the operator set from the SDK so they can't drift.
 */
export function isNegativeProductScope(
    scope: RuleConditions | undefined
): boolean {
    if (!scope) return false;
    const isNegative = (node: RuleCondition | ConditionGroup): boolean => {
        if ("logic" in node) {
            return node.logic === "none" || node.conditions.some(isNegative);
        }
        return NEGATIVE_OPERATORS.has(node.operator);
    };
    const nodes = Array.isArray(scope) ? scope : [scope];
    return nodes.some(isNegative);
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

/**
 * Backend campaign → draft. Reward token is derived from the rewards. The
 * backend bakes the merchant default onto every reward at write time, so a
 * stored token equal to `defaultRewardToken` means the campaign uses the
 * default — drop it back to undefined to round-trip the "use default" choice.
 */
export function campaignToDraft(
    campaign: {
        id: string;
        merchantId: string;
        name: string;
        rule: CampaignRuleDefinition;
        metadata?: CampaignMetadata | null;
        budgetConfig?: BudgetConfigItem[] | null;
        expiresAt?: string | null;
        priority: number;
    },
    defaultRewardToken?: Address
): CampaignDraft {
    const storedToken = campaign.rule.rewards.find((r) => r.token)?.token as
        | Hex
        | undefined;
    const rewardToken =
        storedToken &&
        defaultRewardToken &&
        storedToken.toLowerCase() === defaultRewardToken.toLowerCase()
            ? undefined
            : storedToken;

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
