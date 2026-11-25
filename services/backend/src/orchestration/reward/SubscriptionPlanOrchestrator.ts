import { eventEmitter, log, productEvents } from "@backend-infrastructure";
import type { Address } from "viem";
import { subscriptionStepBy } from "../../domain/campaign";
import type { CampaignRuleSelect } from "../../domain/campaign/db/schema";
import type { CampaignRuleRepository } from "../../domain/campaign/repositories/CampaignRuleRepository";
import type { RewardCalculator } from "../../domain/campaign/services/RewardCalculator";
import type { RewardDefinition } from "../../domain/campaign/types";
import type { MerchantRepository } from "../../domain/merchant/repositories/MerchantRepository";
import type {
    AssetLogInsert,
    AssetLogSelect,
} from "../../domain/rewards/db/schema";
import type { AssetLogRepository } from "../../domain/rewards/repositories/AssetLogRepository";
import type {
    InteractionLogRepository,
    SubscriptionCycle,
} from "../../domain/rewards/repositories/InteractionLogRepository";
import { db, type PgTx } from "../../infrastructure/persistence/postgres";
import type { PricingRepository } from "../../infrastructure/pricing/PricingRepository";
import { roundAmount } from "../../utils/numeric";
import type { IdentityOrchestrator } from "../identity";
import {
    cyclesSinceAnchor,
    definitionFor,
    expiryAfter,
    findRearmable,
    inactivityDaysOf,
    isHeld,
    isReleasedUnsettled,
    MS_PER_DAY,
    mapSteps,
    planLengthOf,
    type StepCycle,
} from "./subscriptionPlan";

const DEFAULT_GRACE_DAYS = 90;

type SyncOptions = {
    /** Plan creation announces itself with `reward_pending`; only later steps unlock. */
    notifyUnlocks?: boolean;
    /** Only a refund takes released steps back; an ordinary sync never does. */
    rehold?: boolean;
};

export type PlanSyncResult = {
    /** A step could not be priced yet: nothing was applied, retry later. */
    deferred: boolean;
};

type BudgetLedger = {
    consumed: Map<string, number>;
    toRestore: Map<string, number>;
};

type TxOutcome = {
    released: AssetLogSelect[];
};

type PlanPrefetch = {
    campaign: CampaignRuleSelect;
    /** Reward-token amount of each cycle an amount plan counts; absent for other plans. */
    tokenAmounts: Map<string, number> | undefined;
};

type Prefetch = {
    merchantToken: Address | undefined;
    plans: Map<string, PlanPrefetch>;
};

/** Thrown so a deferral rolls everything back. */
class PlanDeferred extends Error {}

const planKey = (row: AssetLogSelect) =>
    `${row.interactionLogId}:${row.campaignRuleId}`;

function add(map: Map<string, number>, key: string, amount: number): void {
    map.set(key, (map.get(key) ?? 0) + amount);
}

/**
 * The one reconciler of subscription plans: from the paid cycles of a
 * subscriber it derives the steps earned, then releases, re-prices, re-holds,
 * extends or re-arms the plan's rows to match. Idempotent.
 */
export class SubscriptionPlanOrchestrator {
    constructor(
        private readonly assetLogRepository: AssetLogRepository,
        private readonly interactionLogRepository: InteractionLogRepository,
        private readonly campaignRuleRepository: CampaignRuleRepository,
        private readonly merchantRepository: MerchantRepository,
        private readonly rewardCalculator: RewardCalculator,
        private readonly identityOrchestrator: IdentityOrchestrator,
        private readonly pricingRepository: PricingRepository
    ) {}

    hasPlan(merchantId: string, refereeGroupId: string): Promise<boolean> {
        return this.assetLogRepository.hasPlan(merchantId, refereeGroupId);
    }

    async syncPlan(
        merchantId: string,
        refereeGroupId: string,
        options: SyncOptions = {}
    ): Promise<PlanSyncResult> {
        const ledger: BudgetLedger = {
            consumed: new Map(),
            toRestore: new Map(),
        };

        let outcome: TxOutcome;
        try {
            const prefetch = await this.prefetch(merchantId, refereeGroupId);
            outcome = await db.transaction((tx) =>
                this.reconcile(tx, {
                    merchantId,
                    refereeGroupId,
                    prefetch,
                    ledger,
                    rehold: options.rehold === true,
                })
            );
        } catch (error) {
            await this.restoreAll(ledger.consumed);
            if (error instanceof PlanDeferred) {
                log.info(
                    { merchantId, refereeGroupId },
                    "Plan sync deferred: step not priceable yet"
                );
                return { deferred: true };
            }
            throw error;
        }

        await this.restoreAll(ledger.toRestore);
        if (options.notifyUnlocks !== false) {
            await this.announceUnlocks(merchantId, outcome.released);
            for (const row of outcome.released) {
                productEvents.track(
                    "subscription_step_unlocked",
                    row.identityGroupId,
                    {
                        recipient_type: row.recipientType,
                        step: row.planStep ?? 0,
                    }
                );
            }
        }
        return { deferred: false };
    }

    /** Everything that needs a campaign read or an FX call, gathered before the row locks are taken. */
    private async prefetch(
        merchantId: string,
        refereeGroupId: string
    ): Promise<Prefetch> {
        const plans = new Map<string, PlanPrefetch>();
        const rows = await this.assetLogRepository.findPlanRows(
            db,
            merchantId,
            refereeGroupId
        );
        const merchantToken =
            (await this.merchantRepository.getDefaultRewardToken(merchantId)) ??
            undefined;
        if (rows.length === 0) return { merchantToken, plans };

        const cycles = await this.interactionLogRepository.findCountedCycles(
            merchantId,
            refereeGroupId
        );
        for (const [key, planRows] of this.groupPlans(rows)) {
            const [first] = planRows;
            if (!first?.interactionLogId || !first.campaignRuleId) continue;
            const campaign = await this.campaignRuleRepository.findById(
                first.campaignRuleId
            );
            if (!campaign) continue;
            const tokenAmounts =
                subscriptionStepBy(campaign.rule) === "amount"
                    ? await this.tokenAmounts(
                          cyclesSinceAnchor(cycles, first.interactionLogId),
                          planRows,
                          merchantToken
                      )
                    : undefined;
            plans.set(key, { campaign, tokenAmounts });
        }
        return { merchantToken, plans };
    }

    private async reconcile(
        tx: PgTx,
        params: {
            merchantId: string;
            refereeGroupId: string;
            prefetch: Prefetch;
            ledger: BudgetLedger;
            rehold: boolean;
        }
    ): Promise<TxOutcome> {
        const { merchantId, refereeGroupId, prefetch, ledger } = params;
        const outcome: TxOutcome = { released: [] };
        const rows = await this.assetLogRepository.findPlanRows(
            tx,
            merchantId,
            refereeGroupId,
            true
        );
        if (rows.length === 0) return outcome;

        const cycles = await this.interactionLogRepository.findCountedCycles(
            merchantId,
            refereeGroupId,
            tx
        );

        for (const [key, planRows] of this.groupPlans(rows)) {
            const [first] = planRows;
            const planPrefetch = prefetch.plans.get(key);
            if (!first?.interactionLogId || !planPrefetch) continue;

            const part = await this.reconcilePlan({
                tx,
                campaign: planPrefetch.campaign,
                tokenAmounts: planPrefetch.tokenAmounts,
                anchorId: first.interactionLogId,
                rows: planRows,
                cycles,
                refereeGroupId,
                merchantToken: prefetch.merchantToken,
                ledger,
                rehold: params.rehold,
            });
            outcome.released.push(...part.released);
        }
        return outcome;
    }

    private groupPlans(rows: AssetLogSelect[]): Map<string, AssetLogSelect[]> {
        const plans = new Map<string, AssetLogSelect[]>();
        for (const row of rows) {
            const key = planKey(row);
            plans.set(key, [...(plans.get(key) ?? []), row]);
        }
        return plans;
    }

    private async reconcilePlan(params: {
        tx: PgTx;
        campaign: CampaignRuleSelect;
        tokenAmounts: Map<string, number> | undefined;
        anchorId: string;
        rows: AssetLogSelect[];
        cycles: SubscriptionCycle[];
        refereeGroupId: string;
        merchantToken: Address | undefined;
        ledger: BudgetLedger;
        rehold: boolean;
    }): Promise<TxOutcome> {
        const { tx, campaign, anchorId, cycles, ledger, tokenAmounts } = params;
        const { rewards, subscription } = campaign.rule;
        const empty: TxOutcome = { released: [] };
        // Every paid cycle keeps the plan alive, whether or not it earns a step.
        const lastCycle = cyclesSinceAnchor(cycles, anchorId).at(-1);
        if (!lastCycle) return empty;

        const stepCycles = mapSteps({
            subscription,
            cycles,
            anchorInteractionId: anchorId,
            planLength: planLengthOf(rewards),
            amountOf: (cycle) => {
                const amount = tokenAmounts
                    ? tokenAmounts.get(cycle.interactionLogId)
                    : cycle.merchandiseAmount;
                if (amount === undefined) throw new PlanDeferred();
                return amount;
            },
        });
        const earned = stepCycles.length;
        const expiry = expiryAfter(lastCycle, inactivityDaysOf(campaign.rule));
        let rows = params.rows;

        await this.assetLogRepository.extendHeldExpiry(
            tx,
            rows.filter(isHeld).map((row) => row.id),
            expiry
        );

        const rearmed = await this.rearm(
            tx,
            campaign,
            rows,
            lastCycle,
            expiry,
            ledger
        );
        rows = [...rows, ...rearmed];

        // Only cycle steps follow their cycle's payment; the others were exact at creation.
        const repricedAmounts =
            subscriptionStepBy(campaign.rule) === "cycle"
                ? await this.reprice({
                      tx,
                      campaign,
                      rows: rows.filter(
                          (row) => isHeld(row) && (row.planStep ?? 0) <= earned
                      ),
                      stepCycles,
                      refereeGroupId: params.refereeGroupId,
                      merchantToken: params.merchantToken,
                      ledger,
                  })
                : new Map<string, string>();

        rows = rows.map((row) => ({
            ...row,
            amount: repricedAmounts.get(row.id) ?? row.amount,
        }));

        const released = await this.releaseEarned(
            tx,
            campaign,
            rows.filter((row) => isHeld(row) && (row.planStep ?? 0) <= earned),
            stepCycles
        );
        if (params.rehold) await this.reholdUnearned(tx, rows, earned);
        return { released };
    }

    private async releaseEarned(
        tx: PgTx,
        campaign: CampaignRuleSelect,
        toRelease: AssetLogSelect[],
        stepCycles: StepCycle[]
    ): Promise<AssetLogSelect[]> {
        const lockupMs = (campaign.rule.defaultLockupSeconds ?? 0) * 1000;
        const releasedIds = new Set(
            await this.assetLogRepository.releaseHeld(
                toRelease.map((row) => {
                    const paidAt =
                        stepCycles[(row.planStep ?? 1) - 1]?.cycle.paidAt;
                    return {
                        id: row.id,
                        availableAt:
                            paidAt && lockupMs > 0
                                ? new Date(paidAt.getTime() + lockupMs)
                                : null,
                    };
                }),
                (campaign.rule.pendingRewardExpirationDays ??
                    DEFAULT_GRACE_DAYS) * MS_PER_DAY,
                tx
            )
        );
        return toRelease.filter((row) => releasedIds.has(row.id));
    }

    private async reholdUnearned(
        tx: PgTx,
        rows: AssetLogSelect[],
        earned: number
    ): Promise<void> {
        await this.assetLogRepository.reholdReleased(
            rows
                .filter(
                    (row) =>
                        isReleasedUnsettled(row) && (row.planStep ?? 0) > earned
                )
                .map((row) => row.id),
            tx
        );
    }

    /**
     * Cycle payments in the plan's reward token, the unit of `stepAmount`. The
     * checkout counts only through its prepaid extra cycles, so a plain one needs
     * no rate; a rate (or token) that is missing where needed defers the sync.
     */
    private async tokenAmounts(
        cycles: SubscriptionCycle[],
        rows: AssetLogSelect[],
        merchantToken: Address | undefined
    ): Promise<Map<string, number>> {
        const amounts = new Map<string, number>();
        const token =
            rows.find((row) => row.tokenAddress)?.tokenAddress ?? merchantToken;
        for (const [index, cycle] of cycles.entries()) {
            const counts = index > 0 || cycle.cyclesCovered > 1;
            if (!counts) continue;
            if (cycle.merchandiseAmount <= 0) {
                amounts.set(cycle.interactionLogId, 0);
                continue;
            }
            if (!token) throw new PlanDeferred();
            const conversion =
                await this.pricingRepository.convertFiatToTokenAmount({
                    token,
                    fiatAmount: cycle.merchandiseAmount,
                    currency: cycle.currency,
                });
            if (!conversion.converted) throw new PlanDeferred();
            amounts.set(cycle.interactionLogId, conversion.tokenAmount);
        }
        return amounts;
    }

    /** A dormant plan wakes up: its expired steps get fresh held rows, budget permitting. */
    private async rearm(
        tx: PgTx,
        campaign: CampaignRuleSelect,
        rows: AssetLogSelect[],
        lastCycle: StepCycle["cycle"],
        expiresAt: Date,
        ledger: BudgetLedger
    ): Promise<AssetLogSelect[]> {
        const candidates = findRearmable(rows, lastCycle);
        if (candidates.length === 0) return [];

        const total = roundAmount(
            candidates.reduce((sum, row) => sum + Number(row.amount), 0)
        );
        const budget = await this.campaignRuleRepository.consumeBudget(
            campaign.id,
            total
        );
        if (!budget.success) {
            log.warn(
                { campaignId: campaign.id, total },
                "Plan re-arm skipped: campaign budget is short"
            );
            return [];
        }
        add(ledger.consumed, campaign.id, total);

        const now = new Date();
        const inserts: AssetLogInsert[] = candidates.map((row) => ({
            identityGroupId: row.identityGroupId,
            merchantId: row.merchantId,
            campaignRuleId: row.campaignRuleId,
            assetType: row.assetType,
            amount: row.amount,
            tokenAddress: row.tokenAddress,
            recipientType: row.recipientType,
            recipientWallet: row.recipientWallet,
            referralLinkId: row.referralLinkId,
            interactionLogId: row.interactionLogId,
            planStep: row.planStep,
            status: "pending",
            statusChangedAt: now,
            heldAt: now,
            expiresAt,
        }));
        const created = await this.assetLogRepository.insertPlanRows(
            tx,
            inserts
        );
        productEvents.track("subscription_plan_rearmed", null, {
            campaign_id: campaign.id,
            steps: created.length,
        });
        return created;
    }

    /** Percentage steps are priced on the cycle that earned them; budget follows the difference. */
    private async reprice(params: {
        tx: PgTx;
        campaign: CampaignRuleSelect;
        rows: AssetLogSelect[];
        stepCycles: StepCycle[];
        refereeGroupId: string;
        merchantToken: Address | undefined;
        ledger: BudgetLedger;
    }): Promise<Map<string, string>> {
        const { tx, campaign, stepCycles, ledger } = params;
        const changes: {
            row: AssetLogSelect;
            amount: number;
            delta: number;
        }[] = [];

        for (const row of params.rows) {
            const step = row.planStep ?? 0;
            const stepCycle = stepCycles[step - 1];
            const definition = definitionFor(
                campaign.rule.rewards,
                row.recipientType,
                step
            );
            // A step priced at plan creation already sits on its own cycle.
            if (
                !definition ||
                definition.amountType === "fixed" ||
                !stepCycle ||
                stepCycle.cycle.interactionLogId === row.interactionLogId
            ) {
                continue;
            }

            const amount = await this.priceStep(
                definition,
                stepCycle,
                params.refereeGroupId,
                params.merchantToken,
                row.id
            );
            if (amount === null) continue;
            const delta = roundAmount(amount - Number(row.amount));
            if (delta !== 0) changes.push({ row, amount, delta });
        }

        const approved = await this.reserveDeltas(campaign.id, changes, ledger);
        const repriced = new Map<string, string>();
        for (const { row, amount, delta } of changes) {
            if (!approved.has(row.id)) continue;
            await this.assetLogRepository.updatePlanRowAmount(
                tx,
                row.id,
                String(amount)
            );
            productEvents.track(
                "subscription_step_repriced",
                row.identityGroupId,
                {
                    recipient_type: row.recipientType,
                    step: row.planStep ?? 0,
                    delta,
                }
            );
            repriced.set(row.id, String(amount));
        }
        return repriced;
    }

    /** Null keeps the estimate; a step that cannot be priced yet defers the whole sync. */
    private async priceStep(
        definition: RewardDefinition,
        stepCycle: StepCycle,
        refereeGroupId: string,
        merchantToken: Address | undefined,
        rowId: string
    ): Promise<number | null> {
        const { paidAt, interactionLogId, currency } = stepCycle.cycle;
        const result = await this.rewardCalculator.calculate(
            definition,
            {
                purchase: {
                    orderId: interactionLogId,
                    amount: roundAmount(stepCycle.cycleAmount),
                    currency,
                    items: [],
                },
                user: { identityGroupId: refereeGroupId, walletAddress: null },
                time: {
                    dayOfWeek: paidAt.getUTCDay(),
                    hourOfDay: paidAt.getUTCHours(),
                    date: paidAt.toISOString().split("T")[0],
                    timestamp: Math.floor(paidAt.getTime() / 1000),
                },
            },
            merchantToken
        );
        if (result.success) return result.amount;
        if ("defer" in result) throw new PlanDeferred();
        log.warn(
            { rowId, error: result.error },
            "Plan step kept at its estimate: cycle not priceable"
        );
        return null;
    }

    /**
     * Rises are reserved in one consumption for the campaign, falls are given
     * back once the sync commits. A short budget falls back to row by row, so
     * only the rises that do not fit keep their estimate.
     */
    private async reserveDeltas(
        campaignId: string,
        changes: { row: AssetLogSelect; delta: number }[],
        ledger: BudgetLedger
    ): Promise<Set<string>> {
        const approved = new Set<string>();
        const rises = [];
        for (const { row, delta } of changes) {
            if (delta < 0) {
                add(ledger.toRestore, campaignId, -delta);
                approved.add(row.id);
            } else {
                rises.push({ row, delta });
            }
        }
        if (rises.length === 0) return approved;

        const total = roundAmount(
            rises.reduce((sum, rise) => sum + rise.delta, 0)
        );
        const all = await this.campaignRuleRepository.consumeBudget(
            campaignId,
            total
        );
        if (all.success) {
            add(ledger.consumed, campaignId, total);
            for (const { row } of rises) approved.add(row.id);
            return approved;
        }
        for (const { row, delta } of rises) {
            const one = await this.campaignRuleRepository.consumeBudget(
                campaignId,
                delta
            );
            if (!one.success) {
                log.warn(
                    { rowId: row.id, delta },
                    "Plan step kept at its estimate: campaign budget is short"
                );
                continue;
            }
            add(ledger.consumed, campaignId, delta);
            approved.add(row.id);
        }
        return approved;
    }

    private async restoreAll(amounts: Map<string, number>): Promise<void> {
        for (const [campaignId, amount] of amounts) {
            try {
                await this.campaignRuleRepository.restoreBudget(
                    campaignId,
                    amount
                );
            } catch (error) {
                log.warn(
                    { error, campaignId, amount },
                    "Failed to restore plan budget"
                );
            }
        }
    }

    /** One push per recipient and sync, however many steps unlocked. */
    private async announceUnlocks(
        merchantId: string,
        released: AssetLogSelect[]
    ): Promise<void> {
        if (released.length === 0) return;
        try {
            const byRecipient = new Map<string, AssetLogSelect[]>();
            for (const row of released) {
                const key = `${row.identityGroupId}:${row.recipientType}`;
                byRecipient.set(key, [...(byRecipient.get(key) ?? []), row]);
            }

            const notifications = [];
            for (const group of byRecipient.values()) {
                const [first] = group;
                if (!first) continue;
                const wallet =
                    await this.identityOrchestrator.getWalletForGroup(
                        first.identityGroupId
                    );
                if (!wallet) continue;
                notifications.push({
                    wallets: [wallet],
                    merchantId,
                    rewardCount: group.length,
                    role:
                        first.recipientType === "referrer"
                            ? ("referrer" as const)
                            : ("referee" as const),
                    eurAmount: await this.eurTotal(group),
                });
            }
            if (notifications.length > 0) {
                eventEmitter.emit("notification", {
                    type: "reward_step_unlocked",
                    notifications,
                });
            }
        } catch (error) {
            log.warn({ error }, "Failed to announce unlocked plan steps");
        }
    }

    private async eurTotal(
        rows: AssetLogSelect[]
    ): Promise<number | undefined> {
        let total = 0;
        for (const row of rows) {
            if (!row.tokenAddress) return undefined;
            const price = await this.pricingRepository.getTokenPrice({
                token: row.tokenAddress,
            });
            if (!price) return undefined;
            total += Number(row.amount) * price.eur;
        }
        return Math.round(total * 100) / 100;
    }
}
