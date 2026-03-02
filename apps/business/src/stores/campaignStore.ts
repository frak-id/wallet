import type { Hex } from "viem";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
    BudgetConfigItem,
    CampaignMetadata,
    CampaignRuleDefinition,
    ConditionGroup,
    RuleCondition,
} from "@/types/Campaign";

export type CampaignDraft = {
    id?: string;
    merchantId: string;
    name: string;
    rewardToken?: Hex;
    rule: CampaignRuleDefinition;
    metadata: CampaignMetadata;
    budgetConfig: BudgetConfigItem[];
    scheduled: {
        startDate?: Date;
        endDate?: Date;
    };
    priority: number;
    referralOnly: boolean;
};

const initialDraft: CampaignDraft = {
    merchantId: "",
    name: "",
    rule: {
        trigger: "purchase",
        conditions: [],
        rewards: [],
    },
    metadata: {
        goal: undefined,
        specialCategories: [],
        territories: [],
    },
    budgetConfig: [],
    scheduled: {},
    priority: 0,
    referralOnly: true,
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
            name: "campaign-draft-v4",
            partialize: (s) => ({ draft: s.draft }),
        }
    )
);

/**
 * Convert a Date (or ISO string from Zustand persist deserialization) to unix timestamp
 */
function dateToTimestamp(date: Date | string): number {
    const d = date instanceof Date ? date : new Date(date);
    return Math.floor(d.getTime() / 1000);
}

export function buildScheduleConditions(
    scheduled: CampaignDraft["scheduled"]
): RuleCondition[] {
    const conditions: RuleCondition[] = [];

    if (scheduled.startDate) {
        conditions.push({
            field: "time.timestamp",
            operator: "gte",
            value: dateToTimestamp(scheduled.startDate),
        });
    }

    if (scheduled.endDate) {
        conditions.push({
            field: "time.timestamp",
            operator: "lte",
            value: dateToTimestamp(scheduled.endDate),
        });
    }

    return conditions;
}

export const REFERRAL_CONDITION = {
    field: "attribution.referrerIdentityGroupId",
    operator: "exists" as const,
    value: true,
};

export function buildApiPayload(draft: CampaignDraft) {
    const scheduleConditions = buildScheduleConditions(draft.scheduled);

    const existingConditions = Array.isArray(draft.rule.conditions)
        ? draft.rule.conditions
              .filter((c) => !("field" in c && c.field === "time.timestamp"))
              .filter(
                  (c) =>
                      !(
                          "field" in c &&
                          c.field === "attribution.referrerIdentityGroupId"
                      )
              )
        : draft.rule.conditions;

    const referralConditions =
        (draft.referralOnly ?? true) ? [REFERRAL_CONDITION] : [];

    const allConditions: RuleCondition[] | ConditionGroup = Array.isArray(
        existingConditions
    )
        ? [...referralConditions, ...existingConditions, ...scheduleConditions]
        : {
              ...existingConditions,
              conditions: [
                  ...referralConditions,
                  ...existingConditions.conditions,
                  ...scheduleConditions,
              ],
          };

    const rewards = draft.rewardToken
        ? draft.rule.rewards.map((reward) => ({
              ...reward,
              token: reward.token ?? draft.rewardToken,
          }))
        : draft.rule.rewards;

    return {
        merchantId: draft.merchantId,
        name: draft.name,
        rule: {
            ...draft.rule,
            conditions: allConditions,
            rewards,
        },
        metadata: draft.metadata,
        budgetConfig: draft.budgetConfig,
        expiresAt: draft.scheduled.endDate
            ? (draft.scheduled.endDate instanceof Date
                  ? draft.scheduled.endDate
                  : new Date(draft.scheduled.endDate)
              ).toISOString()
            : undefined,
        priority: draft.priority,
    };
}

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
    const existingToken = campaign.rule.rewards.find((r) => r.token)?.token as
        | Hex
        | undefined;

    const hasReferralCondition = Array.isArray(campaign.rule.conditions)
        ? campaign.rule.conditions.some(
              (c) =>
                  "field" in c &&
                  c.field === "attribution.referrerIdentityGroupId" &&
                  c.operator === "exists"
          )
        : false;

    return {
        id: campaign.id,
        merchantId: campaign.merchantId,
        name: campaign.name,
        rewardToken: existingToken,
        rule: campaign.rule,
        metadata: campaign.metadata ?? {
            goal: undefined,
            specialCategories: [],
            territories: [],
        },
        budgetConfig: campaign.budgetConfig ?? [],
        scheduled: {
            endDate: campaign.expiresAt
                ? new Date(campaign.expiresAt)
                : undefined,
        },
        priority: campaign.priority,
        referralOnly:
            hasReferralCondition ||
            (Array.isArray(campaign.rule.conditions) &&
                campaign.rule.conditions.length === 0),
    };
}
