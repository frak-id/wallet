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
    private calculateAvailableAt(lockupDays?: number): Date | null {
        if (!lockupDays || lockupDays <= 0) return null;
        return new Date(Date.now() + lockupDays * 24 * 60 * 60 * 1000);
    }

    async createBatch(
        params: CreateAssetLogParams[]
    ): Promise<AssetLogSelect[]> {
        if (params.length === 0) return [];

        const inserts: AssetLogInsert[] = params.map((p) => ({
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
            availableAt: this.calculateAvailableAt(p.lockupDays),
        }));

        return db.insert(assetLogsTable).values(inserts).returning();
    }

    async findPendingForSettlement(limit?: number): Promise<AssetLogSelect[]> {
        const now = new Date();
        const query = db
            .select()
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

        if (limit) {
            return query.limit(limit);
        }

        return query;
    }

    /**
     * Cancel a batch of reward entries, recording the reason and timestamp.
     * Returns the affected rows so callers (e.g. RewardCancellationOrchestrator)
     * can restore campaign budget for the cancelled amounts.
     *
     * Only applies to non-terminal statuses (`pending`, `processing`) so that
     * already-settled rewards on-chain are never silently flipped.
     */
    async cancelBatch(
        ids: string[],
        reason: CancellationReason
    ): Promise<
        { id: string; campaignRuleId: string | null; amount: string }[]
    > {
        if (ids.length === 0) return [];

        const now = new Date();
        return db
            .update(assetLogsTable)
            .set({
                status: "cancelled",
                statusChangedAt: now,
                cancelledAt: now,
                cancellationReason: reason,
            })
            .where(
                and(
                    inArray(assetLogsTable.id, ids),
                    inArray(assetLogsTable.status, ["pending", "processing"])
                )
            )
            .returning({
                id: assetLogsTable.id,
                campaignRuleId: assetLogsTable.campaignRuleId,
                amount: assetLogsTable.amount,
            });
    }

    /**
     * Find still-cancellable reward entries (status `pending`) tied to the given
     * interaction log IDs. Used by RewardCancellationOrchestrator to discover
     * rewards triggered by a now-refunded purchase.
     *
     * Locked rewards (`availableAt > now`) are the primary target, but we also
     * include any `pending` rewards that haven't yet been picked up by the
     * settlement cron — the lockup window is the protection envelope, not the
     * sole signal of cancellability.
     */
    async findCancellableByInteractionLogs(
        interactionLogIds: string[]
    ): Promise<AssetLogSelect[]> {
        if (interactionLogIds.length === 0) return [];

        return db
            .select()
            .from(assetLogsTable)
            .where(
                and(
                    inArray(assetLogsTable.interactionLogId, interactionLogIds),
                    eq(assetLogsTable.status, "pending")
                )
            );
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

    async expirePendingRewards(): Promise<
        { campaignRuleId: string; amount: string }[]
    > {
        const now = new Date();

        const results = await db
            .update(assetLogsTable)
            .set({
                status: "expired",
                statusChangedAt: now,
            })
            .where(
                and(
                    eq(assetLogsTable.status, "pending"),
                    isNotNull(assetLogsTable.expiresAt),
                    isNotNull(assetLogsTable.campaignRuleId),
                    lt(assetLogsTable.expiresAt, now)
                )
            )
            .returning({
                campaignRuleId: assetLogsTable.campaignRuleId,
                amount: assetLogsTable.amount,
            });

        return results.filter(
            (r): r is { campaignRuleId: string; amount: string } =>
                r.campaignRuleId !== null
        );
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
