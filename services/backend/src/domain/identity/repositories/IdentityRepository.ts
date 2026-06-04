import { db } from "@backend-infrastructure";
import { and, eq, isNull, ne } from "drizzle-orm";
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
        if (type === "email") {
            return value.trim().toLowerCase();
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

        // Filter out soft-unlinked nodes (loser wallets from a prior
        // merge) so the resolution is deterministic. `ORDER BY createdAt`
        // gives a stable choice when a group legitimately holds multiple
        // active wallets (e.g. multi-passkey accounts post-Phase-1).
        const walletNode = await db.query.identityNodesTable.findFirst({
            where: and(
                eq(identityNodesTable.groupId, groupId),
                eq(identityNodesTable.identityType, "wallet"),
                isNull(identityNodesTable.unlinkedAt)
            ),
            orderBy: (nodes, { asc }) => [asc(nodes.createdAt)],
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

    /**
     * Return the active email currently attached to a group, or `null` when
     * none exists. A group may hold several emails (a merged wallet keeps the
     * loser's email as historical context); the oldest active node wins so
     * the result is stable across subsequent merges that absorb newer rows.
     */
    async findEmailForGroup(groupId: string): Promise<string | null> {
        const node = await db.query.identityNodesTable.findFirst({
            where: and(
                eq(identityNodesTable.groupId, groupId),
                eq(identityNodesTable.identityType, "email"),
                isNull(identityNodesTable.unlinkedAt)
            ),
            orderBy: (nodes, { asc }) => [asc(nodes.createdAt)],
        });
        return node?.identityValue ?? null;
    }

    /**
     * Resolve a group's active email nodes into a verified address + its stamp
     * and a distinct pending address (rotation in progress). `email` falls back
     * to the oldest active node, matching `findEmailForGroup` pre-verification.
     */
    async findEmailStatusForGroup(groupId: string): Promise<{
        email: string | null;
        verifiedAt: Date | null;
        pendingEmail: string | null;
    }> {
        const nodes = await db.query.identityNodesTable.findMany({
            where: and(
                eq(identityNodesTable.groupId, groupId),
                eq(identityNodesTable.identityType, "email"),
                isNull(identityNodesTable.unlinkedAt)
            ),
            orderBy: (n, { asc }) => [asc(n.createdAt)],
        });

        const verified = nodes.find((n) => n.verifiedAt !== null);
        const email =
            verified?.identityValue ?? nodes[0]?.identityValue ?? null;
        const pending = nodes.find(
            (n) => n.verifiedAt === null && n.identityValue !== email
        );

        return {
            email,
            verifiedAt: verified?.verifiedAt ?? null,
            pendingEmail: pending?.identityValue ?? null,
        };
    }

    /**
     * Make `email` the group's verified, active email, reactivating a prior
     * (possibly unlinked) node when one exists so the soft-unlink audit trail
     * survives. Returns `false` without mutating anything when the address is
     * already owned by another group.
     */
    async attachVerifiedEmail(
        groupId: string,
        email: string
    ): Promise<boolean> {
        const normalizedValue = this.normalizeValue("email", email);
        const now = new Date();

        const reactivated = await db
            .update(identityNodesTable)
            .set({ verifiedAt: now, unlinkedAt: null })
            .where(
                and(
                    eq(identityNodesTable.groupId, groupId),
                    eq(identityNodesTable.identityType, "email"),
                    eq(identityNodesTable.identityValue, normalizedValue)
                )
            )
            .returning({ id: identityNodesTable.id });

        if (reactivated.length === 0) {
            const inserted = await db
                .insert(identityNodesTable)
                .values({
                    groupId,
                    identityType: "email",
                    identityValue: normalizedValue,
                    verifiedAt: now,
                })
                .onConflictDoNothing()
                .returning({ id: identityNodesTable.id });
            if (inserted.length === 0) {
                return false;
            }
        }

        this.identityGroupIdCache.delete(
            this.buildIdentityCacheKey("email", normalizedValue)
        );
        return true;
    }

    async unlinkOtherActiveEmails(
        groupId: string,
        exceptEmail: string
    ): Promise<void> {
        await db
            .update(identityNodesTable)
            .set({ unlinkedAt: new Date() })
            .where(
                and(
                    eq(identityNodesTable.groupId, groupId),
                    eq(identityNodesTable.identityType, "email"),
                    isNull(identityNodesTable.unlinkedAt),
                    ne(
                        identityNodesTable.identityValue,
                        this.normalizeValue("email", exceptEmail)
                    )
                )
            );
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
        const cacheKey = this.buildIdentityCacheKey(
            params.type,
            normalizedValue,
            params.merchantId
        );
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

        // Drop the negative cache entry — `findGroupByIdentity` caches
        // `null` for 60s, so a "does this email exist?" check fired
        // moments before this insert would otherwise keep returning null
        // for up to a minute after we just created the row.
        this.identityGroupIdCache.delete(cacheKey);

        // Mirror eviction for the per-group wallet resolver — only wallet
        // inserts can flip a prior `null` cache hit.
        if (params.type === "wallet") {
            this.walletByGroupCache.delete(params.groupId);
        }

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
