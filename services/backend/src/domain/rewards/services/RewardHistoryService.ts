import type { TokenMetadata, TokenPrice } from "@backend-infrastructure";
import Decimal from "decimal.js";
import type { Address } from "viem";
import { roundAmount } from "../../../utils/numeric";
import {
    type PlanStep,
    type PlanStepStatus,
    type PurchaseInfo,
    type RewardHistoryItem,
    type RewardPlan,
    type SubscriptionStepBy,
    subscriptionStepBy,
} from "../schemas";
import type {
    CreateReferralLinkPayload,
    DetailedAssetLog,
    PurchasePayload,
} from "../types";

export type TokenPriceMap = Map<string, TokenPrice | undefined>;
export type PurchaseAmountMap = Map<
    string,
    { totalPrice: string; currencyCode: string }
>;
export type ReferrerPurchaseMap = Map<
    string,
    { purchaseId: string; totalPrice: string; currencyCode: string }
>;

export type PlanRule = {
    rewards: {
        recipient: string;
        amountType: string;
        cycles?: { from: number; to: number };
    }[];
    subscription?: { stepBy?: SubscriptionStepBy; stepDays?: number };
};

export type RewardEnrichmentData = {
    tokenMetadata: Map<Address, TokenMetadata>;
    tokenPrices: TokenPriceMap;
    purchaseAmounts: PurchaseAmountMap;
    referrerPurchases: ReferrerPurchaseMap;
    /** Plan rules per campaign: how steps are earned, and which are estimates. */
    planRules?: Map<string, PlanRule>;
};

const DEAD_STATUSES = new Set(["cancelled", "expired"]);

export class RewardHistoryService {
    /** A plan's steps collapse into the item of its first step. */
    buildRewardItems(
        assetLogs: DetailedAssetLog[],
        enrichment: RewardEnrichmentData
    ): RewardHistoryItem[] {
        const plans = new Map<string, DetailedAssetLog[]>();
        for (const log of assetLogs) {
            if (log.planStep === null) continue;
            const key = this.planKey(log);
            plans.set(key, [...(plans.get(key) ?? []), log]);
        }

        return assetLogs.flatMap((log) => {
            if (log.planStep === null) {
                return [this.buildRewardItem(log, enrichment)];
            }
            const steps = plans.get(this.planKey(log)) ?? [];
            const isFirstStep = log.planStep === 1 && steps[0]?.id === log.id;
            return isFirstStep
                ? [this.buildPlanItem(log, steps, enrichment)]
                : [];
        });
    }

    private planKey(log: DetailedAssetLog): string {
        return `${log.interactionLogId}:${log.campaignRuleId}:${log.recipientType}`;
    }

    private buildPlanItem(
        first: DetailedAssetLog,
        rows: DetailedAssetLog[],
        enrichment: RewardEnrichmentData
    ): RewardHistoryItem {
        const base = this.buildRewardItem(first, enrichment);
        const rule = first.campaignRuleId
            ? enrichment.planRules?.get(first.campaignRuleId)
            : undefined;
        const steps = this.latestRowPerStep(rows).map((row) =>
            this.buildPlanStep(row, enrichment, rule)
        );
        const plan = this.summarizePlan(steps, rule);
        const total = this.sumAmounts(
            steps.filter((step) => step.status !== "expired")
        );
        const next = steps.find(
            (step) => step.status !== "paid" && step.status !== "expired"
        );

        return {
            ...base,
            amount: total,
            status: this.aggregateStatus(plan, next, first),
            settledAt:
                plan.stepsEarned > 0 ? this.lastSettled(steps) : undefined,
            availableAt: next?.availableAt,
            plan,
        };
    }

    /** A re-armed step has an expired row and a live one: the live one speaks. */
    private latestRowPerStep(rows: DetailedAssetLog[]): DetailedAssetLog[] {
        const byStep = new Map<number, DetailedAssetLog>();
        for (const row of rows) {
            const step = row.planStep ?? 0;
            const known = byStep.get(step);
            if (
                !known ||
                (DEAD_STATUSES.has(known.status) &&
                    !DEAD_STATUSES.has(row.status))
            ) {
                byStep.set(step, row);
            }
        }
        return [...byStep.values()].sort(
            (a, b) => (a.planStep ?? 0) - (b.planStep ?? 0)
        );
    }

    private buildPlanStep(
        row: DetailedAssetLog,
        { tokenPrices }: RewardEnrichmentData,
        rule: PlanRule | undefined
    ): PlanStep {
        const status = this.stepStatus(row);
        const definition = rule?.rewards.find(
            (def) =>
                def.recipient === row.recipientType &&
                def.cycles !== undefined &&
                def.cycles.from <= (row.planStep ?? 0) &&
                (row.planStep ?? 0) <= def.cycles.to
        );
        const price = row.tokenAddress
            ? tokenPrices.get(row.tokenAddress)
            : undefined;
        return {
            step: row.planStep ?? 0,
            amount: this.buildTokenAmount(row.amount, price),
            estimated:
                status === "upcoming" &&
                subscriptionStepBy(rule) === "cycle" &&
                definition !== undefined &&
                definition.amountType !== "fixed",
            status,
            availableAt:
                status === "unlocking"
                    ? (row.availableAt ?? undefined)
                    : undefined,
            settledAt: row.settledAt ?? undefined,
        };
    }

    private stepStatus(row: DetailedAssetLog): PlanStepStatus {
        if (row.status === "settled") return "paid";
        if (DEAD_STATUSES.has(row.status)) return "expired";
        return row.held ? "upcoming" : "unlocking";
    }

    private summarizePlan(
        steps: PlanStep[],
        rule: PlanRule | undefined
    ): RewardPlan {
        const paid = steps.filter((step) => step.status === "paid");
        const pending = steps.filter(
            (step) => step.status === "unlocking" || step.status === "upcoming"
        );
        const earned = steps.filter(
            (step) => step.status === "paid" || step.status === "unlocking"
        );
        const stepBy = subscriptionStepBy(rule);
        return {
            stepBy,
            stepDays:
                stepBy === "duration"
                    ? rule?.subscription?.stepDays
                    : undefined,
            stepsEarned: earned.length,
            stepsTotal: steps.length,
            paidAmount: this.sumAmounts(paid),
            pendingAmount: this.sumAmounts(pending),
            estimated: steps.some((step) => step.estimated),
            steps,
        };
    }

    private aggregateStatus(
        plan: RewardPlan,
        next: PlanStep | undefined,
        first: DetailedAssetLog
    ): RewardHistoryItem["status"] {
        const completed =
            plan.steps.length > 0 &&
            plan.steps.every((step) => step.status === "paid");
        if (completed) return "settled";
        if (!next) {
            return plan.stepsEarned > 0
                ? "settled"
                : first.status === "cancelled"
                  ? "cancelled"
                  : "expired";
        }
        if (next.status === "upcoming") return "locked";
        return first.status === "processing" ? "processing" : "pending";
    }

    private lastSettled(steps: PlanStep[]): Date | undefined {
        return steps
            .flatMap((step) => (step.settledAt ? [step.settledAt] : []))
            .sort((a, b) => b.getTime() - a.getTime())[0];
    }

    private sumAmounts(
        steps: Pick<PlanStep, "amount">[]
    ): RewardHistoryItem["amount"] {
        const total = { amount: 0, eurAmount: 0, usdAmount: 0, gbpAmount: 0 };
        for (const { amount } of steps) {
            total.amount += amount.amount;
            total.eurAmount += amount.eurAmount;
            total.usdAmount += amount.usdAmount;
            total.gbpAmount += amount.gbpAmount;
        }
        return {
            amount: roundAmount(total.amount),
            eurAmount: roundAmount(total.eurAmount),
            usdAmount: roundAmount(total.usdAmount),
            gbpAmount: roundAmount(total.gbpAmount),
        };
    }

    private buildRewardItem(
        log: DetailedAssetLog,
        {
            tokenMetadata,
            tokenPrices,
            purchaseAmounts,
            referrerPurchases,
        }: RewardEnrichmentData
    ): RewardHistoryItem {
        const meta = log.tokenAddress
            ? tokenMetadata.get(log.tokenAddress)
            : undefined;
        const price = log.tokenAddress
            ? tokenPrices.get(log.tokenAddress)
            : undefined;
        const decimals = meta?.decimals ?? 18;

        return {
            id: log.id,
            merchant: {
                id: log.merchantId,
                name: log.merchantName,
                domain: log.merchantDomain,
                heroImageUrl:
                    log.merchantExplorerConfig?.heroImageUrl ?? undefined,
                logoUrl: log.merchantExplorerConfig?.logoUrl ?? undefined,
            },
            token: {
                symbol: meta?.symbol ?? "UNKNOWN",
                decimals,
            },
            amount: this.buildTokenAmount(log.amount, price),
            status:
                log.status === "pending" && log.held ? "locked" : log.status,
            role: log.recipientType,
            trigger: log.interactionType ?? "custom",
            txHash: log.onchainTxHash ?? undefined,
            createdAt: log.createdAt,
            settledAt: log.settledAt ?? undefined,
            availableAt: log.availableAt ?? undefined,
            cancellationReason: log.cancellationReason ?? undefined,
            purchase: this.extractPurchaseInfo(
                log,
                purchaseAmounts,
                referrerPurchases
            ),
        };
    }

    private buildTokenAmount(rawAmount: string, price: TokenPrice | undefined) {
        const amount = new Decimal(rawAmount);
        return {
            amount: amount.toNumber(),
            eurAmount: price ? amount.mul(price.eur).toNumber() : 0,
            usdAmount: price ? amount.mul(price.usd).toNumber() : 0,
            gbpAmount: price ? amount.mul(price.gbp).toNumber() : 0,
        };
    }

    private extractPurchaseInfo(
        log: DetailedAssetLog,
        purchaseAmounts: PurchaseAmountMap,
        referrerPurchases: ReferrerPurchaseMap
    ): PurchaseInfo | undefined {
        if (log.recipientType === "referrer") {
            const referrerPurchase = referrerPurchases.get(log.id);
            if (!referrerPurchase) return undefined;
            return {
                id: referrerPurchase.purchaseId,
                amount: new Decimal(referrerPurchase.totalPrice).toNumber(),
                currency: referrerPurchase.currencyCode,
            };
        }

        if (log.interactionType === "purchase" && log.interactionPayload) {
            const payload = log.interactionPayload as PurchasePayload;
            return {
                id: payload.purchaseId,
                amount: payload.amount,
                currency: payload.currency,
            };
        }

        if (
            log.interactionType === "create_referral_link" &&
            log.interactionPayload
        ) {
            const payload = log.interactionPayload as CreateReferralLinkPayload;
            if (payload.purchaseId) {
                const purchase = purchaseAmounts.get(payload.purchaseId);
                if (purchase) {
                    return {
                        id: payload.purchaseId,
                        amount: new Decimal(purchase.totalPrice).toNumber(),
                        currency: purchase.currencyCode,
                    };
                }
            }
        }

        return undefined;
    }
}
