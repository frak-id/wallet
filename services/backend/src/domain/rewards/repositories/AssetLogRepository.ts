import { and, desc, eq, inArray, isNull, sql, sum } from "drizzle-orm";
import type { Address, Hex } from "viem";
import { db } from "../../../infrastructure/persistence/postgres";
import { identityNodesTable } from "../../identity/db/schema";
import {
    type AssetLogInsert,
    type AssetLogSelect,
    assetLogsTable,
    interactionLogsTable,
} from "../db/schema";
import type {
    AssetStatus,
    AssetType,
    CreateAssetLogParams,
    InteractionType,
} from "../types";

export class AssetLogRepository {
    async create(params: CreateAssetLogParams): Promise<AssetLogSelect> {
        const insert: AssetLogInsert = {
            identityGroupId: params.identityGroupId,
            merchantId: params.merchantId,
            campaignRuleId: params.campaignRuleId,
            assetType: params.assetType,
            amount: params.amount.toString(),
            tokenAddress: params.tokenAddress,
            recipientType: params.recipientType,
            recipientWallet: params.recipientWallet,
            chainDepth: params.chainDepth,
            touchpointId: params.touchpointId,
            interactionLogId: params.interactionLogId,
            status: "pending",
            statusChangedAt: new Date(),
        };

        const [result] = await db
            .insert(assetLogsTable)
            .values(insert)
            .returning();

        if (!result) {
            throw new Error("Failed to create asset log");
        }
        return result;
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
        }));

        return db.insert(assetLogsTable).values(inserts).returning();
    }

    async findById(id: string): Promise<AssetLogSelect | null> {
        const [result] = await db
            .select()
            .from(assetLogsTable)
            .where(eq(assetLogsTable.id, id))
            .limit(1);
        return result ?? null;
    }

    async findByIdentityGroup(
        identityGroupId: string,
        options?: {
            status?: AssetStatus;
            assetType?: AssetType;
            limit?: number;
        }
    ): Promise<AssetLogSelect[]> {
        const conditions = [
            eq(assetLogsTable.identityGroupId, identityGroupId),
        ];

        if (options?.status) {
            conditions.push(eq(assetLogsTable.status, options.status));
        }

        if (options?.assetType) {
            conditions.push(eq(assetLogsTable.assetType, options.assetType));
        }

        const query = db
            .select()
            .from(assetLogsTable)
            .where(and(...conditions))
            .orderBy(desc(assetLogsTable.createdAt));

        if (options?.limit) {
            return query.limit(options.limit);
        }

        return query;
    }

    async findByMerchant(
        merchantId: string,
        options?: {
            status?: AssetStatus;
            limit?: number;
        }
    ): Promise<AssetLogSelect[]> {
        const conditions = [eq(assetLogsTable.merchantId, merchantId)];

        if (options?.status) {
            conditions.push(eq(assetLogsTable.status, options.status));
        }

        const query = db
            .select()
            .from(assetLogsTable)
            .where(and(...conditions))
            .orderBy(desc(assetLogsTable.createdAt));

        if (options?.limit) {
            return query.limit(options.limit);
        }

        return query;
    }

    async findPendingForSettlement(limit?: number): Promise<
        Array<
            AssetLogSelect & {
                walletAddress: Address | null;
                interactionType: InteractionType | null;
            }
        >
    > {
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
                createdAt: assetLogsTable.createdAt,
                walletAddress:
                    sql<Address | null>`${identityNodesTable.identityValue}`.as(
                        "walletAddress"
                    ),
                interactionType: interactionLogsTable.type,
            })
            .from(assetLogsTable)
            .leftJoin(
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
                    eq(assetLogsTable.assetType, "token")
                )
            )
            .orderBy(assetLogsTable.createdAt);

        if (limit) {
            return query.limit(limit);
        }

        return query;
    }

    async findPendingWithWallet(limit?: number): Promise<
        Array<
            AssetLogSelect & {
                walletAddress: Address;
                interactionType: InteractionType | null;
            }
        >
    > {
        const results = await this.findPendingForSettlement(limit);
        return results.filter(
            (
                r
            ): r is AssetLogSelect & {
                walletAddress: Address;
                interactionType: InteractionType | null;
            } => r.walletAddress !== null
        );
    }

    async findPendingWithoutWallet(limit?: number): Promise<AssetLogSelect[]> {
        const query = db
            .select({
                asset: assetLogsTable,
            })
            .from(assetLogsTable)
            .leftJoin(
                identityNodesTable,
                and(
                    eq(
                        assetLogsTable.identityGroupId,
                        identityNodesTable.groupId
                    ),
                    eq(identityNodesTable.identityType, "wallet")
                )
            )
            .where(
                and(
                    eq(assetLogsTable.status, "pending"),
                    eq(assetLogsTable.assetType, "token"),
                    isNull(identityNodesTable.id)
                )
            )
            .orderBy(assetLogsTable.createdAt);

        const results = limit ? await query.limit(limit) : await query;
        return results.map((r) => r.asset);
    }

    async updateStatus(
        id: string,
        status: AssetStatus,
        onchainData?: { txHash: Hex; blockNumber: bigint }
    ): Promise<AssetLogSelect | null> {
        const updateData: Partial<AssetLogInsert> = {
            status,
            statusChangedAt: new Date(),
        };

        if (onchainData) {
            updateData.onchainTxHash = onchainData.txHash;
            updateData.onchainBlock = onchainData.blockNumber;
        }

        const [result] = await db
            .update(assetLogsTable)
            .set(updateData)
            .where(eq(assetLogsTable.id, id))
            .returning();

        return result ?? null;
    }

    async updateStatusBatch(
        ids: string[],
        status: AssetStatus,
        onchainData?: { txHash: Hex; blockNumber: bigint }
    ): Promise<number> {
        if (ids.length === 0) return 0;

        const updateData: Partial<AssetLogInsert> = {
            status,
            statusChangedAt: new Date(),
        };

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

    async updateRecipientWallet(
        identityGroupId: string,
        wallet: Address
    ): Promise<number> {
        const results = await db
            .update(assetLogsTable)
            .set({
                recipientWallet: wallet,
                statusChangedAt: new Date(),
            })
            .where(
                and(
                    eq(assetLogsTable.identityGroupId, identityGroupId),
                    isNull(assetLogsTable.recipientWallet)
                )
            )
            .returning({ id: assetLogsTable.id });

        return results.length;
    }

    async getTotalByStatus(
        merchantId: string,
        status: AssetStatus
    ): Promise<{ total: number; count: number }> {
        const [result] = await db
            .select({
                total: sum(assetLogsTable.amount),
                count: sql<number>`count(*)::int`,
            })
            .from(assetLogsTable)
            .where(
                and(
                    eq(assetLogsTable.merchantId, merchantId),
                    eq(assetLogsTable.status, status)
                )
            );

        return {
            total: result?.total ? Number.parseFloat(result.total) : 0,
            count: result?.count ?? 0,
        };
    }

    async getTotalByIdentityGroup(
        identityGroupId: string,
        options?: {
            status?: AssetStatus;
            assetType?: AssetType;
        }
    ): Promise<{ total: number; count: number }> {
        const conditions = [
            eq(assetLogsTable.identityGroupId, identityGroupId),
        ];

        if (options?.status) {
            conditions.push(eq(assetLogsTable.status, options.status));
        }

        if (options?.assetType) {
            conditions.push(eq(assetLogsTable.assetType, options.assetType));
        }

        const [result] = await db
            .select({
                total: sum(assetLogsTable.amount),
                count: sql<number>`count(*)::int`,
            })
            .from(assetLogsTable)
            .where(and(...conditions));

        return {
            total: result?.total ? Number.parseFloat(result.total) : 0,
            count: result?.count ?? 0,
        };
    }

    async findByInteractionLog(
        interactionLogId: string
    ): Promise<AssetLogSelect[]> {
        return db
            .select()
            .from(assetLogsTable)
            .where(eq(assetLogsTable.interactionLogId, interactionLogId))
            .orderBy(assetLogsTable.createdAt);
    }
}
