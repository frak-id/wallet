import {
    and,
    desc,
    eq,
    gt,
    inArray,
    isNotNull,
    isNull,
    lt,
    lte,
    or,
    sql,
} from "drizzle-orm";
import type { Address, Hex } from "viem";
import { db } from "../../../infrastructure/persistence/postgres";

import { merchantsTable } from "../../merchant/db/schema";
import { RewardConfig } from "../config";
import {
    type AssetLogInsert,
    type AssetLogSelect,
    assetLogsTable,
    interactionLogsTable,
} from "../db/schema";
import type {
    AssetStatus,
    CancellationReason,
    CreateAssetLogParams,
    DetailedAssetLog,
    InteractionType,
    RecipientType,
} from "../types";

const DEFAULT_EXPIRATION_DAYS = 60;

export class AssetLogRepository {
    private calculateExpiresAt(expirationDays?: number): Date {
        const days = expirationDays ?? DEFAULT_EXPIRATION_DAYS;
        return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    }

    /**
     * Compute the timestamp at which a locked reward becomes claimable.
     * Returns `null` when the reward should be available immediately.
     */
    private calculateAvailableAt(lockupSeconds?: number): Date | null {
        if (!lockupSeconds || lockupSeconds <= 0) return null;
        return new Date(Date.now() + lockupSeconds * 1000);
    }

    async createBatch(
        params: CreateAssetLogParams[]
    ): Promise<AssetLogSelect[]> {
        if (params.length === 0) return [];

        return db
            .insert(assetLogsTable)
            .values(this.buildInserts(params))
            .returning();
    }

    /**
     * Pure mapping from public reward params to the row shape we persist.
     * Exposed so callers running inside a transaction (e.g.
     * `BatchRewardOrchestrator.processSingleInteraction`) can reuse the same
     * derivation rules — expirations, lockup `available_at` — without going
     * through `createBatch` and breaking the surrounding tx.
     */
    buildInserts(params: CreateAssetLogParams[]): AssetLogInsert[] {
        return params.map((p) => ({
            identityGroupId: p.identityGroupId,
            merchantId: p.merchantId,
            campaignRuleId: p.campaignRuleId,
            assetType: p.assetType,
            amount: p.amount.toString(),
            tokenAddress: p.tokenAddress,
            recipientType: p.recipientType,
            recipientWallet: p.recipientWallet,
            chainDepth: p.chainDepth,
            referralLinkId: p.referralLinkId,
            interactionLogId: p.interactionLogId,
            status: "pending" as const,
            statusChangedAt: new Date(),
            expiresAt: this.calculateExpiresAt(p.expirationDays),
            availableAt: this.calculateAvailableAt(p.lockupSeconds),
        }));
    }

    /**
     * Atomically claim rewards for settlement: lock eligible rows with
     * `FOR UPDATE SKIP LOCKED` and flip them to `processing` in the SAME
     * transaction. The lock must live inside a transaction — a bare autocommit
     * `SELECT ... FOR UPDATE SKIP LOCKED` releases it before the on-chain push,
     * letting two replicas claim and double-pay the same rows. Once committed
     * the rows are no longer `pending`, so a concurrent run cannot re-pick them.
     *
     * Only `pending` rows are claimed. `bank_depleted` rewards are requeued to
     * `pending` out-of-band by the requeue-depleted cron once their bank can
     * pay again, keeping this hot path from re-checking dead banks every run.
     *
     * `settlementAttempts` is intentionally not bumped here; only an actual
     * on-chain push (`markSettlementProcessing`) spends an attempt, so rows
     * skipped before the push are retried via `resetStuckSettlementProcessing`.
     */
    async claimPendingForSettlement(limit?: number): Promise<AssetLogSelect[]> {
        const now = new Date();

        return db.transaction(async (tx) => {
            const lockable = tx
                .select({ id: assetLogsTable.id })
                .from(assetLogsTable)
                .where(
                    and(
                        eq(assetLogsTable.status, "pending"),
                        eq(assetLogsTable.assetType, "token"),
                        lt(
                            assetLogsTable.settlementAttempts,
                            RewardConfig.settlement.maxAttempts
                        ),
                        or(
                            isNull(assetLogsTable.expiresAt),
                            gt(assetLogsTable.expiresAt, now)
                        ),
                        // Exclude rewards still inside their lockup window.
                        or(
                            isNull(assetLogsTable.availableAt),
                            lte(assetLogsTable.availableAt, now)
                        )
                    )
                )
                .orderBy(assetLogsTable.createdAt)
                .for("update", { skipLocked: true });

            const locked = limit ? await lockable.limit(limit) : await lockable;

            if (locked.length === 0) return [];

            return tx
                .update(assetLogsTable)
                .set({ status: "processing", statusChangedAt: now })
                .where(
                    inArray(
                        assetLogsTable.id,
                        locked.map((row) => row.id)
                    )
                )
                .returning();
        });
    }

    /**
     * Smallest still-owed amount per (merchant, token) across all
     * `bank_depleted` rewards. Drives the requeue cron: comparing a bank's
     * live balance against this minimum tells whether *any* depleted reward
     * for that token could settle, so a requeue is never pure churn. `amount`
     * is human units (numeric); the caller converts to wei via the token's
     * decimals.
     */
    async findDepletedAmountsByMerchantAndToken(): Promise<
        { merchantId: string; tokenAddress: Address; minAmount: string }[]
    > {
        const rows = await db
            .select({
                merchantId: assetLogsTable.merchantId,
                tokenAddress: assetLogsTable.tokenAddress,
                minAmount: sql<string>`min(${assetLogsTable.amount})`,
            })
            .from(assetLogsTable)
            .where(
                and(
                    eq(assetLogsTable.status, "bank_depleted"),
                    eq(assetLogsTable.assetType, "token"),
                    isNotNull(assetLogsTable.tokenAddress)
                )
            )
            .groupBy(assetLogsTable.merchantId, assetLogsTable.tokenAddress);

        return rows as {
            merchantId: string;
            tokenAddress: Address;
            minAmount: string;
        }[];
    }

    /**
     * Flip `bank_depleted` rewards back to `pending` for the given
     * (merchant, token) pairs once their bank can pay again. Idempotent across
     * replicas: the `status = 'bank_depleted'` guard means a row already
     * requeued by a concurrent run is simply not matched again.
     */
    async requeueDepletedToPending(
        groups: { merchantId: string; tokenAddress: Address }[]
    ): Promise<number> {
        if (groups.length === 0) return 0;

        const results = await db
            .update(assetLogsTable)
            .set({ status: "pending", statusChangedAt: new Date() })
            .where(
                and(
                    eq(assetLogsTable.status, "bank_depleted"),
                    or(
                        ...groups.map((group) =>
                            and(
                                eq(assetLogsTable.merchantId, group.merchantId),
                                eq(
                                    assetLogsTable.tokenAddress,
                                    group.tokenAddress
                                )
                            )
                        )
                    )
                )
            )
            .returning({ id: assetLogsTable.id });

        return results.length;
    }

    /**
     * Atomically move every still-owed reward tied to the given interaction
     * logs to a terminal non-settled state and record the reason. Used by the
     * refund flow to cancel rewards triggered by a now-refunded purchase.
     *
     * Both `pending` and `bank_depleted` rows are voided: neither has paid out
     * on-chain, and `bank_depleted` is only a soft retry marker (a later run
     * can still settle it once the bank refills), so skipping it would let a
     * refunded purchase pay out after a refill.
     *
     * Skipped rows:
     *  - rewards in `processing`/`settled` (already pushed on-chain — must not
     *    be flipped from underneath the transaction);
     *  - rewards without a `campaignRuleId` (campaign was deleted — nothing
     *    to restore, ignore gracefully).
     *
     * Single SQL round-trip; eliminates the find-then-update race window.
     */
    async cancelPendingByInteractionLogs(
        interactionLogIds: string[],
        reason: CancellationReason
    ): Promise<{ id: string; campaignRuleId: string; amount: string }[]> {
        if (interactionLogIds.length === 0) return [];

        const now = new Date();
        const status: AssetStatus =
            reason === "expired" ? "expired" : "cancelled";

        const rows = await db
            .update(assetLogsTable)
            .set({
                status,
                statusChangedAt: now,
                cancelledAt: now,
                cancellationReason: reason,
            })
            .where(
                and(
                    inArray(assetLogsTable.interactionLogId, interactionLogIds),
                    inArray(assetLogsTable.status, [
                        "pending",
                        "bank_depleted",
                    ]),
                    isNotNull(assetLogsTable.campaignRuleId)
                )
            )
            .returning({
                id: assetLogsTable.id,
                campaignRuleId: assetLogsTable.campaignRuleId,
                amount: assetLogsTable.amount,
            });

        // `campaignRuleId` is non-null thanks to the WHERE clause.
        return rows as { id: string; campaignRuleId: string; amount: string }[];
    }

    async updateStatusBatch(
        ids: string[],
        status: AssetStatus,
        onchainData?: { txHash: Hex; blockNumber: bigint }
    ): Promise<number> {
        if (ids.length === 0) return 0;

        const now = new Date();
        const updateData: Partial<AssetLogInsert> = {
            status: status as AssetStatus,
            statusChangedAt: now,
        };

        if (status === "settled") {
            updateData.settledAt = now;
        }

        if (onchainData) {
            updateData.onchainTxHash = onchainData.txHash;
            updateData.onchainBlock = onchainData.blockNumber;
        }

        const results = await db
            .update(assetLogsTable)
            .set(updateData)
            .where(inArray(assetLogsTable.id, ids))
            .returning({ id: assetLogsTable.id });

        return results.length;
    }

    async markSettlementProcessing(ids: string[]): Promise<number> {
        if (ids.length === 0) return 0;

        const results = await db
            .update(assetLogsTable)
            .set({
                status: "processing",
                statusChangedAt: new Date(),
                settlementAttempts: sql`${assetLogsTable.settlementAttempts} + 1`,
            })
            .where(inArray(assetLogsTable.id, ids))
            .returning({ id: assetLogsTable.id });

        return results.length;
    }

    async revertSettlementToPending(
        ids: string[],
        error: string
    ): Promise<number> {
        if (ids.length === 0) return 0;

        const results = await db
            .update(assetLogsTable)
            .set({
                status: "pending",
                statusChangedAt: new Date(),
                lastSettlementError: error,
            })
            .where(inArray(assetLogsTable.id, ids))
            .returning({ id: assetLogsTable.id });

        return results.length;
    }

    async resetStuckSettlementProcessing(
        olderThanMinutes: number
    ): Promise<number> {
        const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);

        const results = await db
            .update(assetLogsTable)
            .set({
                status: "pending",
                statusChangedAt: new Date(),
            })
            .where(
                and(
                    eq(assetLogsTable.status, "processing"),
                    lt(assetLogsTable.statusChangedAt, cutoff)
                )
            )
            .returning({ id: assetLogsTable.id });

        return results.length;
    }

    /**
     * Atomically expire every still-owed reward whose `expires_at` deadline
     * has passed. Both `pending` and `bank_depleted` rows qualify: a reward
     * stuck `bank_depleted` because the merchant never refilled the bank must
     * still reach a terminal state at its deadline instead of being re-checked
     * forever. Rewards whose campaign was deleted (`campaign_rule_id` is NULL)
     * are included too — otherwise they would linger forever, never settling
     * (past deadline) nor reaching a terminal state. Returns the affected rows
     * so the caller can restore the corresponding campaign budgets; rows with a
     * NULL `campaignRuleId` carry no budget to restore and are ignored by
     * `restoreBudgetsBatch`. Single SQL round-trip; no find-then-update race.
     */
    async expirePendingPastDeadline(): Promise<
        { id: string; campaignRuleId: string | null; amount: string }[]
    > {
        const now = new Date();
        return db
            .update(assetLogsTable)
            .set({
                status: "expired",
                statusChangedAt: now,
                cancelledAt: now,
                cancellationReason: "expired",
            })
            .where(
                and(
                    inArray(assetLogsTable.status, [
                        "pending",
                        "bank_depleted",
                    ]),
                    isNotNull(assetLogsTable.expiresAt),
                    lt(assetLogsTable.expiresAt, now)
                )
            )
            .returning({
                id: assetLogsTable.id,
                campaignRuleId: assetLogsTable.campaignRuleId,
                amount: assetLogsTable.amount,
            });
    }

    async findByIdentityGroups(
        identityGroupIds: string[],
        options?: { status?: AssetStatus[] }
    ): Promise<
        {
            id: string;
            amount: string;
            tokenAddress: Address | null;
            status: AssetStatus;
            recipientType: RecipientType;
            createdAt: Date;
            settledAt: Date | null;
            onchainTxHash: Hex | null;
            interactionType: InteractionType | null;
            merchantId: string;
            merchantName: string;
            merchantDomain: string;
        }[]
    > {
        const whereConditions = [
            inArray(assetLogsTable.identityGroupId, identityGroupIds),
            eq(assetLogsTable.assetType, "token"),
            isNotNull(assetLogsTable.tokenAddress),
        ];

        if (options?.status && options.status.length > 0) {
            whereConditions.push(
                inArray(assetLogsTable.status, options.status)
            );
        }

        return db
            .select({
                id: assetLogsTable.id,
                amount: assetLogsTable.amount,
                tokenAddress: assetLogsTable.tokenAddress,
                status: assetLogsTable.status,
                recipientType: assetLogsTable.recipientType,
                createdAt: assetLogsTable.createdAt,
                settledAt: assetLogsTable.settledAt,
                onchainTxHash: assetLogsTable.onchainTxHash,
                interactionType: interactionLogsTable.type,
                merchantId: merchantsTable.id,
                merchantName: merchantsTable.name,
                merchantDomain: merchantsTable.domain,
            })
            .from(assetLogsTable)
            .leftJoin(
                interactionLogsTable,
                eq(assetLogsTable.interactionLogId, interactionLogsTable.id)
            )
            .innerJoin(
                merchantsTable,
                eq(assetLogsTable.merchantId, merchantsTable.id)
            )
            .where(and(...whereConditions))
            .orderBy(desc(assetLogsTable.createdAt));
    }

    async findDetailedByIdentityGroup(
        identityGroupId: string,
        options?: { limit?: number; offset?: number }
    ): Promise<DetailedAssetLog[]> {
        return db
            .select({
                id: assetLogsTable.id,
                amount: assetLogsTable.amount,
                tokenAddress: assetLogsTable.tokenAddress,
                status: assetLogsTable.status,
                recipientType: assetLogsTable.recipientType,
                createdAt: assetLogsTable.createdAt,
                settledAt: assetLogsTable.settledAt,
                availableAt: assetLogsTable.availableAt,
                cancellationReason: assetLogsTable.cancellationReason,
                onchainTxHash: assetLogsTable.onchainTxHash,
                interactionType: interactionLogsTable.type,
                interactionPayload: interactionLogsTable.payload,
                referralLinkId: assetLogsTable.referralLinkId,
                identityGroupId: assetLogsTable.identityGroupId,
                merchantId: merchantsTable.id,
                merchantName: merchantsTable.name,
                merchantDomain: merchantsTable.domain,
                merchantExplorerConfig: merchantsTable.explorerConfig,
            })
            .from(assetLogsTable)
            .leftJoin(
                interactionLogsTable,
                eq(assetLogsTable.interactionLogId, interactionLogsTable.id)
            )
            .innerJoin(
                merchantsTable,
                eq(assetLogsTable.merchantId, merchantsTable.id)
            )
            .where(
                and(
                    eq(assetLogsTable.identityGroupId, identityGroupId),
                    eq(assetLogsTable.assetType, "token"),
                    isNotNull(assetLogsTable.tokenAddress)
                )
            )
            .orderBy(desc(assetLogsTable.createdAt))
            .limit(options?.limit ?? 500)
            .offset(options?.offset ?? 0);
    }

    async countByIdentityGroup(identityGroupId: string): Promise<number> {
        const [result] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(assetLogsTable)
            .where(
                and(
                    eq(assetLogsTable.identityGroupId, identityGroupId),
                    eq(assetLogsTable.assetType, "token"),
                    isNotNull(assetLogsTable.tokenAddress)
                )
            );
        return result?.count ?? 0;
    }

    async countByCampaignAndUserAsReferee(
        campaignRuleId: string,
        identityGroupId: string
    ): Promise<number> {
        const [result] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(assetLogsTable)
            .where(
                and(
                    eq(assetLogsTable.campaignRuleId, campaignRuleId),
                    eq(assetLogsTable.identityGroupId, identityGroupId),
                    inArray(assetLogsTable.status, [
                        "pending",
                        "processing",
                        "settled",
                        "bank_depleted",
                    ]),
                    eq(assetLogsTable.recipientType, "referee")
                )
            );
        return result?.count ?? 0;
    }

    async countByMerchantAndUserAsReferee(
        merchantId: string,
        identityGroupId: string
    ): Promise<number> {
        const [result] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(assetLogsTable)
            .where(
                and(
                    eq(assetLogsTable.merchantId, merchantId),
                    eq(assetLogsTable.identityGroupId, identityGroupId),
                    inArray(assetLogsTable.status, [
                        "pending",
                        "processing",
                        "settled",
                        "bank_depleted",
                    ]),
                    eq(assetLogsTable.recipientType, "referee")
                )
            );
        return result?.count ?? 0;
    }
}
