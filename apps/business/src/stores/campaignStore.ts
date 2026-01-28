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
    rule: CampaignRuleDefinition;
    metadata: CampaignMetadata;
    budgetConfig: BudgetConfigItem[];
    scheduled: {
        startDate?: Date;
        endDate?: Date;
    };
    priority: number;
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

function dateToTimestamp(date: Date): number {
    return Math.floor(date.getTime() / 1000);
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

export function buildApiPayload(draft: CampaignDraft) {
    const scheduleConditions = buildScheduleConditions(draft.scheduled);

    const existingConditions = Array.isArray(draft.rule.conditions)
        ? draft.rule.conditions.filter(
              (c) => !("field" in c && c.field === "time.timestamp")
          )
        : draft.rule.conditions;

    const allConditions: RuleCondition[] | ConditionGroup = Array.isArray(
        existingConditions
    )
        ? [...existingConditions, ...scheduleConditions]
        : {
              ...existingConditions,
              conditions: [
                  ...existingConditions.conditions,
                  ...scheduleConditions,
              ],
          };

    return {
        merchantId: draft.merchantId,
        name: draft.name,
        rule: {
            ...draft.rule,
            conditions: allConditions,
        },
        metadata: draft.metadata,
        budgetConfig: draft.budgetConfig,
        expiresAt: draft.scheduled.endDate?.toISOString(),
        priority: draft.priority,
    };
}

export function campaignToDraft(campaign: {
    id: string;
    merchantId: string;
    name: string;
    rule: CampaignRuleDefinition;
    metadata: CampaignMetadata | null;
    budgetConfig: BudgetConfigItem[] | null;
    expiresAt: string | null;
    priority: number;
}): CampaignDraft {
    return {
        id: campaign.id,
        merchantId: campaign.merchantId,
        name: campaign.name,
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
    };
}
