import { and, desc, eq, gt, isNull, lt, or } from "drizzle-orm";
import { db } from "../../../infrastructure/persistence/postgres";
import {
    type CampaignRuleInsert,
    type CampaignRuleSelect,
    campaignRulesTable,
} from "../db/schema";
import type {
    BudgetConfig,
    BudgetConsumptionResult,
    BudgetUsed,
    CampaignTrigger,
} from "../types";

function computeNextResetAt(durationInSeconds: number): string {
    const now = Date.now();
    const nextReset = now + durationInSeconds * 1000;
    return new Date(nextReset).toISOString();
}

function processbudgetUsed(
    config: BudgetConfig,
    used: BudgetUsed,
    amount: number
): {
    canConsume: boolean;
    exceededLabel?: string;
    updatedUsed: BudgetUsed;
    remaining: Record<string, number>;
} {
    const now = new Date().toISOString();
    const updatedUsed: BudgetUsed = { ...used };
    const remaining: Record<string, number> = {};

    for (const budget of config) {
        const current = updatedUsed[budget.label] ?? { used: 0 };

        if (
            budget.durationInSeconds !== null &&
            current.resetAt &&
            current.resetAt < now
        ) {
            current.used = 0;
            current.resetAt = computeNextResetAt(budget.durationInSeconds);
        }

        if (budget.durationInSeconds !== null && !current.resetAt) {
            current.resetAt = computeNextResetAt(budget.durationInSeconds);
        }

        const newUsed = current.used + amount;
        if (newUsed > budget.amount) {
            return {
                canConsume: false,
                exceededLabel: budget.label,
                updatedUsed,
                remaining,
            };
        }

        updatedUsed[budget.label] = {
            ...current,
            used: newUsed,
        };
        remaining[budget.label] = budget.amount - newUsed;
    }

    return { canConsume: true, updatedUsed, remaining };
}

export class CampaignRuleRepository {
    async findById(id: string): Promise<CampaignRuleSelect | null> {
        const [result] = await db
            .select()
            .from(campaignRulesTable)
            .where(eq(campaignRulesTable.id, id))
            .limit(1);
        return result ?? null;
    }

    async findActiveByMerchant(
        merchantId: string,
        trigger?: CampaignTrigger
    ): Promise<CampaignRuleSelect[]> {
        const now = new Date();

        const results = await db
            .select()
            .from(campaignRulesTable)
            .where(
                and(
                    eq(campaignRulesTable.merchantId, merchantId),
                    isNull(campaignRulesTable.deactivatedAt),
                    or(
                        isNull(campaignRulesTable.expiresAt),
                        gt(campaignRulesTable.expiresAt, now)
                    )
                )
            )
            .orderBy(desc(campaignRulesTable.priority));

        if (trigger) {
            return results.filter((r) => r.rule.trigger === trigger);
        }

        return results;
    }

    async create(rule: CampaignRuleInsert): Promise<CampaignRuleSelect> {
        const [result] = await db
            .insert(campaignRulesTable)
            .values(rule)
            .returning();
        if (!result) {
            throw new Error("Failed to create campaign rule");
        }
        return result;
    }

    async update(
        id: string,
        updates: Partial<
            Pick<
                CampaignRuleInsert,
                "name" | "priority" | "rule" | "budgetConfig" | "expiresAt"
            >
        >
    ): Promise<CampaignRuleSelect | null> {
        const [result] = await db
            .update(campaignRulesTable)
            .set({ ...updates, updatedAt: new Date() })
            .where(eq(campaignRulesTable.id, id))
            .returning();
        return result ?? null;
    }

    async deactivate(id: string): Promise<CampaignRuleSelect | null> {
        const [result] = await db
            .update(campaignRulesTable)
            .set({ deactivatedAt: new Date(), updatedAt: new Date() })
            .where(eq(campaignRulesTable.id, id))
            .returning();
        return result ?? null;
    }

    async reactivate(id: string): Promise<CampaignRuleSelect | null> {
        const [result] = await db
            .update(campaignRulesTable)
            .set({ deactivatedAt: null, updatedAt: new Date() })
            .where(eq(campaignRulesTable.id, id))
            .returning();
        return result ?? null;
    }

    async delete(id: string): Promise<boolean> {
        const result = await db
            .delete(campaignRulesTable)
            .where(eq(campaignRulesTable.id, id))
            .returning({ id: campaignRulesTable.id });
        return result.length > 0;
    }

    async consumeBudget(
        campaignRuleId: string,
        amount: number
    ): Promise<BudgetConsumptionResult> {
        const [campaign] = await db
            .select({
                budgetConfig: campaignRulesTable.budgetConfig,
                budgetUsed: campaignRulesTable.budgetUsed,
            })
            .from(campaignRulesTable)
            .where(eq(campaignRulesTable.id, campaignRuleId))
            .limit(1);

        if (!campaign) {
            return { success: false, reason: "campaign_not_found" };
        }

        if (!campaign.budgetConfig || campaign.budgetConfig.length === 0) {
            return { success: true, remaining: {} };
        }

        const currentUsed = campaign.budgetUsed ?? {};
        const result = processbudgetUsed(
            campaign.budgetConfig,
            currentUsed,
            amount
        );

        if (!result.canConsume) {
            return {
                success: false,
                reason: "budget_exceeded",
                exceededBudget: result.exceededLabel,
            };
        }

        await db
            .update(campaignRulesTable)
            .set({
                budgetUsed: result.updatedUsed,
                updatedAt: new Date(),
            })
            .where(eq(campaignRulesTable.id, campaignRuleId));

        return { success: true, remaining: result.remaining };
    }

    async rollbackBudget(
        campaignRuleId: string,
        amount: number
    ): Promise<void> {
        const [campaign] = await db
            .select({
                budgetConfig: campaignRulesTable.budgetConfig,
                budgetUsed: campaignRulesTable.budgetUsed,
            })
            .from(campaignRulesTable)
            .where(eq(campaignRulesTable.id, campaignRuleId))
            .limit(1);

        if (!campaign?.budgetConfig || !campaign.budgetUsed) {
            return;
        }

        const updatedUsed: BudgetUsed = { ...campaign.budgetUsed };

        for (const budget of campaign.budgetConfig) {
            const current = updatedUsed[budget.label];
            if (current) {
                current.used = Math.max(0, current.used - amount);
            }
        }

        await db
            .update(campaignRulesTable)
            .set({
                budgetUsed: updatedUsed,
                updatedAt: new Date(),
            })
            .where(eq(campaignRulesTable.id, campaignRuleId));
    }

    async getBudgetStatus(campaignRuleId: string): Promise<{
        budgets: Record<
            string,
            { used: number; limit: number; remaining: number; resetAt?: string }
        >;
    } | null> {
        const [result] = await db
            .select({
                budgetConfig: campaignRulesTable.budgetConfig,
                budgetUsed: campaignRulesTable.budgetUsed,
            })
            .from(campaignRulesTable)
            .where(eq(campaignRulesTable.id, campaignRuleId))
            .limit(1);

        if (!result) return null;

        const budgets: Record<
            string,
            { used: number; limit: number; remaining: number; resetAt?: string }
        > = {};

        if (!result.budgetConfig) {
            return { budgets };
        }

        const now = new Date().toISOString();

        for (const config of result.budgetConfig) {
            const usedEntry = result.budgetUsed?.[config.label];
            let used = usedEntry?.used ?? 0;

            if (
                config.durationInSeconds !== null &&
                usedEntry?.resetAt &&
                usedEntry.resetAt < now
            ) {
                used = 0;
            }

            budgets[config.label] = {
                used,
                limit: config.amount,
                remaining: config.amount - used,
                resetAt: usedEntry?.resetAt,
            };
        }

        return { budgets };
    }

    async findByMerchant(merchantId: string): Promise<CampaignRuleSelect[]> {
        return db
            .select()
            .from(campaignRulesTable)
            .where(eq(campaignRulesTable.merchantId, merchantId))
            .orderBy(desc(campaignRulesTable.priority));
    }

    async findExpired(): Promise<CampaignRuleSelect[]> {
        const now = new Date();
        return db
            .select()
            .from(campaignRulesTable)
            .where(
                and(
                    isNull(campaignRulesTable.deactivatedAt),
                    lt(campaignRulesTable.expiresAt, now)
                )
            );
    }
}
