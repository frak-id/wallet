import type {
    CampaignRuleInsert,
    CampaignRuleSelect,
    CampaignStatus,
} from "../db/schema";
import type { CampaignRuleRepository } from "../repositories/CampaignRuleRepository";
import type { BudgetConfig, CampaignRuleDefinition } from "../types";

export type CampaignCreateInput = {
    merchantId: string;
    name: string;
    rule: CampaignRuleDefinition;
    metadata?: Record<string, unknown>;
    budgetConfig?: BudgetConfig;
    expiresAt?: Date;
    priority?: number;
};

export type CampaignUpdateInput = {
    name?: string;
    rule?: CampaignRuleDefinition;
    metadata?: Record<string, unknown>;
    budgetConfig?: BudgetConfig;
    expiresAt?: Date | null;
    priority?: number;
};

export type CampaignResult<T = CampaignRuleSelect> =
    | { success: true; campaign: T }
    | { success: false; error: string };

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

    async create(input: CampaignCreateInput): Promise<CampaignResult> {
        const validationError = this.validateRuleDefinition(input.rule);
        if (validationError) {
            return { success: false, error: validationError };
        }

        const campaign = await this.campaignRuleRepository.create({
            merchantId: input.merchantId,
            name: input.name,
            rule: input.rule,
            metadata: input.metadata,
            budgetConfig: input.budgetConfig,
            expiresAt: input.expiresAt,
            priority: input.priority ?? 0,
            status: "draft",
        });

        return { success: true, campaign };
    }

    async update(
        campaignId: string,
        input: CampaignUpdateInput
    ): Promise<CampaignResult> {
        const campaign = await this.campaignRuleRepository.findById(campaignId);
        if (!campaign) {
            return { success: false, error: "Campaign not found" };
        }

        if (campaign.status === "archived") {
            return { success: false, error: "Cannot edit archived campaigns" };
        }

        const isDraft = campaign.status === "draft";

        if (!isDraft && input.rule) {
            return {
                success: false,
                error: "Cannot modify rule definition after publishing. Only name, budget, and expiration can be changed.",
            };
        }

        if (input.rule) {
            const validationError = this.validateRuleDefinition(input.rule);
            if (validationError) {
                return { success: false, error: validationError };
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
            return { success: true, campaign };
        }

        const updated = await this.campaignRuleRepository.update(
            campaignId,
            cleanUpdates
        );

        if (!updated) {
            return { success: false, error: "Failed to update campaign" };
        }

        return { success: true, campaign: updated };
    }

    async publish(campaignId: string): Promise<CampaignResult> {
        return this.transitionStatus(campaignId, "publish");
    }

    async pause(campaignId: string): Promise<CampaignResult> {
        return this.transitionStatus(campaignId, "pause");
    }

    async resume(campaignId: string): Promise<CampaignResult> {
        return this.transitionStatus(campaignId, "resume");
    }

    async archive(campaignId: string): Promise<CampaignResult> {
        return this.transitionStatus(campaignId, "archive");
    }

    async delete(campaignId: string): Promise<CampaignResult<null>> {
        const campaign = await this.campaignRuleRepository.findById(campaignId);
        if (!campaign) {
            return { success: false, error: "Campaign not found" };
        }

        if (campaign.status !== "draft") {
            return {
                success: false,
                error: "Only draft campaigns can be deleted. Use archive for published campaigns.",
            };
        }

        const deleted = await this.campaignRuleRepository.delete(campaignId);
        if (!deleted) {
            return { success: false, error: "Failed to delete campaign" };
        }

        return { success: true, campaign: null };
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
    ): Promise<CampaignResult> {
        const campaign = await this.campaignRuleRepository.findById(campaignId);
        if (!campaign) {
            return { success: false, error: "Campaign not found" };
        }

        const transition = VALID_TRANSITIONS[action];
        if (!transition) {
            return { success: false, error: `Unknown action: ${action}` };
        }

        if (!transition.from.includes(campaign.status)) {
            return {
                success: false,
                error: `Cannot ${action} campaign with status '${campaign.status}'. Valid from statuses: ${transition.from.join(", ")}`,
            };
        }

        if (action === "publish") {
            const validationError = this.validateForPublish(campaign);
            if (validationError) {
                return { success: false, error: validationError };
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
            return { success: false, error: `Failed to ${action} campaign` };
        }

        return { success: true, campaign: updated };
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
                break;
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
