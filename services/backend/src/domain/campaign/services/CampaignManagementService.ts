import { HttpError } from "@backend-utils";
import type { CampaignRuleInsert, CampaignRuleSelect } from "../db/schema";
import type { CampaignRuleRepository } from "../repositories/CampaignRuleRepository";
import type { CampaignStatus } from "../schemas";
import type {
    BudgetConfig,
    CampaignRuleDefinition,
    ConditionGroup,
    RuleCondition,
    TieredRewardDefinition,
} from "../types";

// The business app encodes a campaign start as a `time.timestamp >= <unix s>`
// top-level rule condition (mirrors `extractStartDate` in the SDK). It is the
// only part of the ruleset that carries a date; the end date lives in the
// `expiresAt` column, never in the rule.
const START_DATE_FIELD = "time.timestamp";

function isStartDateCondition(node: RuleCondition | ConditionGroup): boolean {
    return (
        !("logic" in node) &&
        node.field === START_DATE_FIELD &&
        (node.operator === "gte" || node.operator === "gt")
    );
}

// Read the current start gate (unix seconds) from a rule, if any. Mirrors the
// SDK's `extractStartDate`: takes the earliest of the top-level gates.
function currentStartUnix(rule: CampaignRuleDefinition): number | undefined {
    const nodes = Array.isArray(rule.conditions)
        ? rule.conditions
        : rule.conditions.conditions;
    const values = nodes
        .filter(isStartDateCondition)
        .map((node) => (node as RuleCondition).value)
        .filter((value): value is number => typeof value === "number");
    return values.length > 0 ? Math.min(...values) : undefined;
}

// Merge a scoped start-date gate into an existing rule: drop any current
// top-level `time.timestamp` gate and, when a date is given, add a fresh
// `>=` condition (unix seconds). Triggers, rewards and every other condition
// are left untouched, which is what makes this safe to run on published
// campaigns where the full rule is otherwise locked.
// Drop any existing top-level start gate and append the new one (when set).
// Generic so the flat-array branch keeps its narrow `RuleCondition[]` type.
function withStartGate<T extends RuleCondition | ConditionGroup>(
    nodes: T[],
    gate: RuleCondition | null
): (T | RuleCondition)[] {
    const filtered = nodes.filter((c) => !isStartDateCondition(c));
    return gate ? [...filtered, gate] : filtered;
}

function applyStartDate(
    rule: CampaignRuleDefinition,
    startDate: Date | null
): CampaignRuleDefinition {
    const nextCondition: RuleCondition | null = startDate
        ? {
              field: START_DATE_FIELD,
              operator: "gte",
              value: Math.floor(startDate.getTime() / 1000),
          }
        : null;

    const { conditions } = rule;
    if (Array.isArray(conditions)) {
        return {
            ...rule,
            conditions: withStartGate(conditions, nextCondition),
        };
    }
    return {
        ...rule,
        conditions: {
            ...conditions,
            conditions: withStartGate(conditions.conditions, nextCondition),
        },
    };
}

type CampaignCreateInput = {
    merchantId: string;
    name: string;
    rule: CampaignRuleDefinition;
    metadata?: Record<string, unknown>;
    budgetConfig?: BudgetConfig;
    expiresAt?: Date;
    priority?: number;
};

type CampaignUpdateInput = {
    name?: string;
    rule?: CampaignRuleDefinition;
    metadata?: Record<string, unknown>;
    budgetConfig?: BudgetConfig;
    expiresAt?: Date | null;
    priority?: number;
    // Scoped start-date edit. Unlike `rule`, this is permitted on published
    // campaigns: `null` clears the start gate, a Date sets/moves it, and
    // `undefined` leaves it unchanged.
    startDate?: Date | null;
};

type StatusTransition = {
    from: CampaignStatus[];
    to: CampaignStatus;
};

const VALID_TRANSITIONS: Record<string, StatusTransition> = {
    publish: { from: ["draft"], to: "active" },
    pause: { from: ["active"], to: "paused" },
    resume: { from: ["paused"], to: "active" },
    archive: { from: ["draft", "active", "paused"], to: "archived" },
};

export class CampaignManagementService {
    constructor(
        private readonly campaignRuleRepository: CampaignRuleRepository
    ) {}

    async create(input: CampaignCreateInput): Promise<CampaignRuleSelect> {
        return this.campaignRuleRepository.create({
            merchantId: input.merchantId,
            name: input.name,
            rule: input.rule,
            metadata: input.metadata,
            budgetConfig: input.budgetConfig,
            expiresAt: input.expiresAt,
            priority: input.priority ?? 0,
            status: "draft",
        });
    }

    async update(
        campaignId: string,
        input: CampaignUpdateInput
    ): Promise<CampaignRuleSelect> {
        const campaign = await this.campaignRuleRepository.findById(campaignId);
        if (!campaign) {
            throw HttpError.notFound(
                "CAMPAIGN_NOT_FOUND",
                "Campaign not found"
            );
        }

        if (campaign.status === "archived") {
            throw HttpError.conflict(
                "CAMPAIGN_ARCHIVED",
                "Cannot edit archived campaigns"
            );
        }

        const isDraft = campaign.status === "draft";

        if (!isDraft && input.rule) {
            throw HttpError.badRequest(
                "RULE_LOCKED",
                "Cannot modify rule definition after publishing. Only name, budget, and expiration can be changed."
            );
        }

        if (input.rule) {
            const validationError = this.validateRuleDefinition(input.rule);
            if (validationError) {
                throw HttpError.badRequest("INVALID_RULE", validationError);
            }
        }

        const allowedUpdates: Partial<CampaignRuleInsert> = {};

        allowedUpdates.name = input.name;
        allowedUpdates.budgetConfig = input.budgetConfig;
        allowedUpdates.expiresAt = input.expiresAt;

        if (isDraft) {
            allowedUpdates.rule = input.rule;
            allowedUpdates.metadata = input.metadata;
            allowedUpdates.priority = input.priority;
        }

        // Scoped start-date edit, allowed on published campaigns too. A full
        // `rule` payload (draft path) already carries its own start gate, so
        // only apply this when no full rule was supplied to avoid clobbering it.
        if (input.startDate !== undefined && input.rule === undefined) {
            if (!isDraft) {
                this.assertStartDateMovesForward(campaign, input.startDate);
            }
            allowedUpdates.rule = applyStartDate(
                campaign.rule,
                input.startDate
            );
        }

        const cleanUpdates = Object.fromEntries(
            Object.entries(allowedUpdates).filter(([_, v]) => v !== undefined)
        ) as Parameters<typeof this.campaignRuleRepository.update>[1];

        if (Object.keys(cleanUpdates).length === 0) {
            return campaign;
        }

        // Every field-permission decision above was made against the status
        // we read, so the write re-checks it atomically (TOCTOU guard, same
        // pattern as transitionStatus). 0 rows = a concurrent transition (or
        // delete) invalidated those decisions — surface it as a conflict.
        const updated = await this.campaignRuleRepository.update(
            campaignId,
            cleanUpdates,
            [campaign.status]
        );

        if (!updated) {
            throw HttpError.conflict(
                "CONCURRENT_MODIFICATION",
                "Campaign status changed while updating, please retry"
            );
        }

        return updated;
    }

    // On a published campaign the start date may only move forward: pulling it
    // earlier (or clearing it) would retroactively widen the window and match
    // purchases that happened before the campaign was ever meant to run.
    private assertStartDateMovesForward(
        campaign: CampaignRuleSelect,
        startDate: Date | null
    ): void {
        const currentGate = currentStartUnix(campaign.rule);

        if (startDate === null) {
            // Clearing an explicit gate drops the start back to publish time.
            if (currentGate !== undefined) {
                throw HttpError.badRequest(
                    "START_DATE_BACKWARD",
                    "Start date can only be moved forward on a published campaign"
                );
            }
            return;
        }

        const publishedUnix = campaign.publishedAt
            ? Math.floor(campaign.publishedAt.getTime() / 1000)
            : undefined;
        // Floor is the current gate when set, otherwise when it went live.
        const floor = currentGate ?? publishedUnix ?? 0;
        const next = Math.floor(startDate.getTime() / 1000);
        if (next < floor) {
            throw HttpError.badRequest(
                "START_DATE_BACKWARD",
                "Start date can only be moved forward on a published campaign"
            );
        }
    }

    async publish(campaignId: string): Promise<CampaignRuleSelect> {
        return this.transitionStatus(campaignId, "publish");
    }

    async pause(campaignId: string): Promise<CampaignRuleSelect> {
        return this.transitionStatus(campaignId, "pause");
    }

    async resume(campaignId: string): Promise<CampaignRuleSelect> {
        return this.transitionStatus(campaignId, "resume");
    }

    async archive(campaignId: string): Promise<CampaignRuleSelect> {
        return this.transitionStatus(campaignId, "archive");
    }

    async delete(campaignId: string): Promise<void> {
        const campaign = await this.campaignRuleRepository.findById(campaignId);
        if (!campaign) {
            throw HttpError.notFound(
                "CAMPAIGN_NOT_FOUND",
                "Campaign not found"
            );
        }

        if (campaign.status !== "draft") {
            throw HttpError.conflict(
                "NOT_DRAFT",
                "Only draft campaigns can be deleted. Use archive for published campaigns."
            );
        }

        // The DELETE re-checks `status = 'draft'` atomically (TOCTOU guard):
        // 0 rows means a concurrent publish/transition or delete won the race.
        const deleted = await this.campaignRuleRepository.delete(campaignId);
        if (!deleted) {
            throw HttpError.conflict(
                "NOT_DRAFT",
                "Only draft campaigns can be deleted. Use archive for published campaigns."
            );
        }
    }

    async getById(campaignId: string): Promise<CampaignRuleSelect | null> {
        return this.campaignRuleRepository.findById(campaignId);
    }

    async getByMerchant(
        merchantId: string,
        statusFilter?: CampaignStatus[]
    ): Promise<CampaignRuleSelect[]> {
        if (statusFilter && statusFilter.length > 0) {
            return this.campaignRuleRepository.findByMerchantAndStatus(
                merchantId,
                statusFilter
            );
        }
        return this.campaignRuleRepository.findByMerchant(merchantId);
    }

    private async transitionStatus(
        campaignId: string,
        action: keyof typeof VALID_TRANSITIONS
    ): Promise<CampaignRuleSelect> {
        const campaign = await this.campaignRuleRepository.findById(campaignId);
        if (!campaign) {
            throw HttpError.notFound(
                "CAMPAIGN_NOT_FOUND",
                "Campaign not found"
            );
        }

        const transition = VALID_TRANSITIONS[action];
        if (!transition) {
            throw HttpError.badRequest(
                "UNKNOWN_ACTION",
                `Unknown action: ${action}`
            );
        }

        if (!transition.from.includes(campaign.status)) {
            throw HttpError.conflict(
                "INVALID_TRANSITION",
                `Cannot ${action} campaign with status '${campaign.status}'. Valid from statuses: ${transition.from.join(", ")}`
            );
        }

        if (action === "publish") {
            const publishError = this.validateForPublish(campaign);
            if (publishError) {
                throw HttpError.badRequest("PUBLISH_INVALID", publishError);
            }
            const ruleError = this.validateRuleDefinition(campaign.rule);
            if (ruleError) {
                throw HttpError.badRequest("INVALID_RULE", ruleError);
            }
        }

        let updated: CampaignRuleSelect | null = null;

        switch (action) {
            case "publish":
                updated = await this.campaignRuleRepository.publish(campaignId);
                break;
            case "pause":
                updated = await this.campaignRuleRepository.pause(campaignId);
                break;
            case "resume":
                updated = await this.campaignRuleRepository.resume(campaignId);
                break;
            case "archive":
                updated = await this.campaignRuleRepository.archive(campaignId);
                break;
        }

        if (!updated) {
            // The pre-read validation above passed, but the guarded UPDATE
            // (`WHERE id = $1 AND status = ANY(from)`) affected zero rows: a
            // concurrent transition changed the status between the read and
            // the write. Surface it the same way as the pre-read check.
            throw HttpError.conflict(
                "INVALID_TRANSITION",
                `Cannot ${action} campaign: status changed concurrently. Valid from statuses: ${transition.from.join(", ")}`
            );
        }

        return updated;
    }

    private validateRuleDefinition(
        rule: CampaignRuleDefinition
    ): string | null {
        if (!rule.trigger) {
            return "Rule must have a trigger";
        }

        if (!rule.rewards || rule.rewards.length === 0) {
            return "Rule must have at least one reward";
        }

        for (const reward of rule.rewards) {
            const error = this.validateReward(reward);
            if (error) return error;
        }

        return null;
    }

    private validateReward(
        reward: CampaignRuleDefinition["rewards"][0]
    ): string | null {
        if (!reward.recipient) return "Each reward must have a recipient";
        if (!reward.type) return "Each reward must have a type";
        if (!reward.amountType) return "Each reward must have an amount type";

        return this.validateRewardAmount(reward);
    }

    private validateRewardAmount(
        reward: CampaignRuleDefinition["rewards"][0]
    ): string | null {
        switch (reward.amountType) {
            case "fixed":
                if (typeof reward.amount !== "number" || reward.amount <= 0) {
                    return "Fixed reward must have a positive amount";
                }
                break;
            case "percentage":
                if (
                    typeof reward.percent !== "number" ||
                    reward.percent <= 0 ||
                    reward.percent > 100
                ) {
                    return "Percentage reward must have percent between 0 and 100";
                }
                break;
            case "tiered":
                if (!reward.tiers || reward.tiers.length === 0) {
                    return "Tiered reward must have at least one tier";
                }
                return this.validateTiers(reward);
        }
        return null;
    }

    private validateTiers(reward: TieredRewardDefinition): string | null {
        for (const tier of reward.tiers) {
            const error = this.validateSingleTier(tier, reward.tierField);
            if (error) return error;
        }
        return this.validateTierRanges(reward.tiers);
    }

    private validateSingleTier(
        tier: TieredRewardDefinition["tiers"][0],
        tierField: string
    ): string | null {
        const hasAmount = "amount" in tier;
        const hasPercent = "percent" in tier;
        if (hasAmount === hasPercent) {
            return "Each tier must have exactly one of amount or percent";
        }
        if (hasAmount && tier.amount <= 0) {
            return "Tier amount must be positive";
        }
        if (hasPercent && (tier.percent <= 0 || tier.percent > 100)) {
            return "Tier percent must be between 0 and 100";
        }
        if (hasPercent && tierField !== "purchase.amount") {
            return "Percent tiers require tierField purchase.amount";
        }
        if (tier.maxValue !== undefined && tier.minValue >= tier.maxValue) {
            return "Tier minValue must be lower than maxValue";
        }
        return null;
    }

    // Touching boundaries ({0-100}, {100-∞}) are fine — runtime matching
    // sorts by minValue desc, so the upper tier deterministically wins.
    private validateTierRanges(
        tiers: TieredRewardDefinition["tiers"]
    ): string | null {
        const sorted = [...tiers].sort((a, b) => a.minValue - b.minValue);
        for (let i = 1; i < sorted.length; i++) {
            const prev = sorted[i - 1];
            if (
                prev.maxValue === undefined ||
                prev.maxValue > sorted[i].minValue
            ) {
                return "Tier ranges must not overlap";
            }
        }
        return null;
    }

    private validateForPublish(campaign: CampaignRuleSelect): string | null {
        if (!campaign.budgetConfig || campaign.budgetConfig.length === 0) {
            return "Campaign must have a budget configuration before publishing";
        }

        return null;
    }
}
