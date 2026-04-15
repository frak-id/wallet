import { db } from "@backend-infrastructure";
import { and, eq, isNull } from "drizzle-orm";
import { LRUCache } from "lru-cache";
import type { Address } from "viem";
import { identityGroupsTable, identityNodesTable } from "../db/schema";
import type { IdentityType } from "../schemas";

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

    private normalizeValue(type: IdentityType, value: string): string {
        if (type === "wallet") {
            return value.toLowerCase();
        }
        return value;
    }

    private buildIdentityCacheKey(
        type: IdentityType,
        value: string,
        merchantId?: string
    ): string {
        return `${type}:${this.normalizeValue(type, value)}:${merchantId ?? ""}`;
    }

    invalidateCachesForGroup(groupId: string): void {
        this.walletByGroupCache.delete(groupId);
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
            const group = await this.findGroupById(cached.value);
            if (group) return group;
            // Group was deleted (merged), invalidate stale cache entry and re-query
            this.identityGroupIdCache.delete(cacheKey);
        }

        const normalizedValue = this.normalizeValue(params.type, params.value);
        const node = await db.query.identityNodesTable.findFirst({
            where: and(
                eq(identityNodesTable.identityType, params.type),
                eq(identityNodesTable.identityValue, normalizedValue),
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

    /**
     * Find all identity group IDs that contain a wallet node for the given address.
     * Unlike findGroupByIdentity, this returns ALL groups (any merchantId).
     */
    async findAllGroupIdsByWallet(walletAddress: Address): Promise<string[]> {
        const normalized = walletAddress.toLowerCase();
        const nodes = await db
            .select({ groupId: identityNodesTable.groupId })
            .from(identityNodesTable)
            .where(
                and(
                    eq(identityNodesTable.identityType, "wallet"),
                    eq(identityNodesTable.identityValue, normalized)
                )
            );
        return [...new Set(nodes.map((n) => n.groupId))];
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

    async findAnonymousFingerprint(params: {
        groupId: string;
        merchantId: string;
    }): Promise<string | null> {
        const node = await db.query.identityNodesTable.findFirst({
            where: and(
                eq(identityNodesTable.groupId, params.groupId),
                eq(identityNodesTable.identityType, "anonymous_fingerprint"),
                eq(identityNodesTable.merchantId, params.merchantId)
            ),
        });
        return node?.identityValue ?? null;
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
        const normalizedValue = this.normalizeValue(params.type, params.value);
        const [result] = await db
            .insert(identityNodesTable)
            .values({
                groupId: params.groupId,
                identityType: params.type,
                identityValue: normalizedValue,
                merchantId: params.merchantId,
            })
            .onConflictDoNothing()
            .returning();

        if (!result) {
            const existing = await db.query.identityNodesTable.findFirst({
                where: and(
                    eq(identityNodesTable.identityType, params.type),
                    eq(identityNodesTable.identityValue, normalizedValue),
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
}
