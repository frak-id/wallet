import { HttpError } from "@backend-utils";
import type { CampaignRuleInsert, CampaignRuleSelect } from "../db/schema";
import type { CampaignRuleRepository } from "../repositories/CampaignRuleRepository";
import type { CampaignStatus } from "../schemas";
import type {
    BudgetConfig,
    CampaignRuleDefinition,
    TieredRewardDefinition,
} from "../types";

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

        const cleanUpdates = Object.fromEntries(
            Object.entries(allowedUpdates).filter(([_, v]) => v !== undefined)
        ) as Parameters<typeof this.campaignRuleRepository.update>[1];

        if (Object.keys(cleanUpdates).length === 0) {
            return campaign;
        }

        const updated = await this.campaignRuleRepository.update(
            campaignId,
            cleanUpdates
        );

        if (!updated) {
            throw HttpError.internal(
                "UPDATE_FAILED",
                "Failed to update campaign"
            );
        }

        return updated;
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

        const deleted = await this.campaignRuleRepository.delete(campaignId);
        if (!deleted) {
            throw HttpError.internal(
                "DELETE_FAILED",
                "Failed to delete campaign"
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
            throw HttpError.internal(
                "TRANSITION_FAILED",
                `Failed to ${action} campaign`
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
