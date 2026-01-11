import { db } from "@backend-infrastructure";
import { and, eq, isNull } from "drizzle-orm";
import { LRUCache } from "lru-cache";
import type { Address } from "viem";
import {
    identityGroupsTable,
    identityNodesTable,
    type identityTypeEnum,
} from "../db/schema";

type IdentityType = (typeof identityTypeEnum.enumValues)[number];
type IdentityGroupSelect = typeof identityGroupsTable.$inferSelect;
type IdentityNodeSelect = typeof identityNodesTable.$inferSelect;

export class IdentityRepository {
    private readonly identityGroupIdCache = new LRUCache<
        string,
        { value: string | null }
    >({
        max: 10_000,
        ttl: 60_000,
    });

    private readonly walletByGroupCache = new LRUCache<
        string,
        { value: Address | null }
    >({
        max: 10_000,
        ttl: 60_000,
    });

    private buildIdentityCacheKey(
        type: IdentityType,
        value: string,
        merchantId?: string
    ): string {
        return `${type}:${value}:${merchantId ?? ""}`;
    }

    invalidateCachesForGroup(groupId: string): void {
        this.walletByGroupCache.delete(groupId);
    }

    invalidateIdentityCache(
        type: IdentityType,
        value: string,
        merchantId?: string
    ): void {
        const key = this.buildIdentityCacheKey(type, value, merchantId);
        this.identityGroupIdCache.delete(key);
    }
    async findGroupById(id: string): Promise<IdentityGroupSelect | null> {
        const result = await db.query.identityGroupsTable.findFirst({
            where: eq(identityGroupsTable.id, id),
        });
        return result ?? null;
    }

    async findGroupByIdentity(params: {
        type: IdentityType;
        value: string;
        merchantId?: string;
    }): Promise<IdentityGroupSelect | null> {
        const cacheKey = this.buildIdentityCacheKey(
            params.type,
            params.value,
            params.merchantId
        );

        const cached = this.identityGroupIdCache.get(cacheKey);
        if (cached) {
            if (!cached.value) return null;
            return this.findGroupById(cached.value);
        }

        const node = await db.query.identityNodesTable.findFirst({
            where: and(
                eq(identityNodesTable.identityType, params.type),
                eq(identityNodesTable.identityValue, params.value),
                params.merchantId
                    ? eq(identityNodesTable.merchantId, params.merchantId)
                    : isNull(identityNodesTable.merchantId)
            ),
        });

        if (!node) {
            this.identityGroupIdCache.set(cacheKey, { value: null });
            return null;
        }

        this.identityGroupIdCache.set(cacheKey, { value: node.groupId });
        return this.findGroupById(node.groupId);
    }

    async getWalletForGroup(groupId: string): Promise<Address | null> {
        const cached = this.walletByGroupCache.get(groupId);
        if (cached) {
            return cached.value;
        }

        const walletNode = await db.query.identityNodesTable.findFirst({
            where: and(
                eq(identityNodesTable.groupId, groupId),
                eq(identityNodesTable.identityType, "wallet")
            ),
        });

        const wallet = (walletNode?.identityValue as Address) ?? null;
        this.walletByGroupCache.set(groupId, { value: wallet });
        return wallet;
    }

    async hasWallet(groupId: string): Promise<boolean> {
        const wallet = await this.getWalletForGroup(groupId);
        return wallet !== null;
    }

    async findGroupWithWallet(params: {
        type: IdentityType;
        value: string;
        merchantId?: string;
    }): Promise<{ id: string; wallet: Address | null } | null> {
        const group = await this.findGroupByIdentity(params);
        if (!group) return null;

        const wallet = await this.getWalletForGroup(group.id);
        return { id: group.id, wallet };
    }

    async createGroup(): Promise<IdentityGroupSelect> {
        const [result] = await db
            .insert(identityGroupsTable)
            .values({})
            .returning();
        if (!result) {
            throw new Error("Failed to create identity group");
        }
        return result;
    }

    async addNode(params: {
        groupId: string;
        type: IdentityType;
        value: string;
        merchantId?: string;
    }): Promise<IdentityNodeSelect> {
        const [result] = await db
            .insert(identityNodesTable)
            .values({
                groupId: params.groupId,
                identityType: params.type,
                identityValue: params.value,
                merchantId: params.merchantId,
            })
            .onConflictDoNothing()
            .returning();

        if (!result) {
            const existing = await db.query.identityNodesTable.findFirst({
                where: and(
                    eq(identityNodesTable.identityType, params.type),
                    eq(identityNodesTable.identityValue, params.value),
                    params.merchantId
                        ? eq(identityNodesTable.merchantId, params.merchantId)
                        : isNull(identityNodesTable.merchantId)
                ),
            });
            if (!existing) {
                throw new Error("Failed to create identity node");
            }
            return existing;
        }
        return result;
    }

    async getNodesForGroup(groupId: string): Promise<IdentityNodeSelect[]> {
        return db.query.identityNodesTable.findMany({
            where: eq(identityNodesTable.groupId, groupId),
        });
    }

    async moveNodesToGroup(
        fromGroupId: string,
        toGroupId: string
    ): Promise<number> {
        const result = await db
            .update(identityNodesTable)
            .set({ groupId: toGroupId })
            .where(eq(identityNodesTable.groupId, fromGroupId));
        return result.count;
    }
}
