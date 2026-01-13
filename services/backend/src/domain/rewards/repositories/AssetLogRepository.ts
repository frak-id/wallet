import {
    and,
    eq,
    gt,
    inArray,
    isNotNull,
    isNull,
    lt,
    or,
    sql,
} from "drizzle-orm";
import type { Address, Hex } from "viem";
import { db } from "../../../infrastructure/persistence/postgres";
import { identityNodesTable } from "../../identity/db/schema";
import { RewardConfig } from "../config";
import {
    type AssetLogInsert,
    type AssetLogSelect,
    assetLogsTable,
    interactionLogsTable,
} from "../db/schema";
import type {
    AssetStatus,
    CreateAssetLogParams,
    InteractionType,
} from "../types";

const DEFAULT_EXPIRATION_DAYS = 60;

export class AssetLogRepository {
    private calculateExpiresAt(expirationDays?: number): Date {
        const days = expirationDays ?? DEFAULT_EXPIRATION_DAYS;
        return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
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
            touchpointId: p.touchpointId,
            interactionLogId: p.interactionLogId,
            status: "pending" as const,
            statusChangedAt: new Date(),
            expiresAt: this.calculateExpiresAt(p.expirationDays),
        }));

        return db.insert(assetLogsTable).values(inserts).returning();
    }

    async findPendingForSettlement(limit?: number): Promise<
        Array<
            AssetLogSelect & {
                walletAddress: Address;
                interactionType: InteractionType | null;
            }
        >
    > {
        const now = new Date();
        const query = db
            .select({
                id: assetLogsTable.id,
                identityGroupId: assetLogsTable.identityGroupId,
                merchantId: assetLogsTable.merchantId,
                campaignRuleId: assetLogsTable.campaignRuleId,
                assetType: assetLogsTable.assetType,
                amount: assetLogsTable.amount,
                tokenAddress: assetLogsTable.tokenAddress,
                recipientType: assetLogsTable.recipientType,
                recipientWallet: assetLogsTable.recipientWallet,
                chainDepth: assetLogsTable.chainDepth,
                status: assetLogsTable.status,
                statusChangedAt: assetLogsTable.statusChangedAt,
                touchpointId: assetLogsTable.touchpointId,
                interactionLogId: assetLogsTable.interactionLogId,
                onchainTxHash: assetLogsTable.onchainTxHash,
                onchainBlock: assetLogsTable.onchainBlock,
                settlementAttempts: assetLogsTable.settlementAttempts,
                lastSettlementError: assetLogsTable.lastSettlementError,
                createdAt: assetLogsTable.createdAt,
                settledAt: assetLogsTable.settledAt,
                expiresAt: assetLogsTable.expiresAt,
                walletAddress:
                    sql<Address>`${identityNodesTable.identityValue}`.as(
                        "walletAddress"
                    ),
                interactionType: interactionLogsTable.type,
            })
            .from(assetLogsTable)
            .innerJoin(
                identityNodesTable,
                and(
                    eq(
                        assetLogsTable.identityGroupId,
                        identityNodesTable.groupId
                    ),
                    eq(identityNodesTable.identityType, "wallet")
                )
            )
            .leftJoin(
                interactionLogsTable,
                eq(assetLogsTable.interactionLogId, interactionLogsTable.id)
            )
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

    async updateStatusBatch(
        ids: string[],
        status: AssetStatus,
        onchainData?: { txHash: Hex; blockNumber: bigint }
    ): Promise<number> {
        if (ids.length === 0) return 0;

        const now = new Date();
        const updateData: Partial<AssetLogInsert> = {
            status,
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
        Array<{ campaignRuleId: string; amount: string }>
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
}
