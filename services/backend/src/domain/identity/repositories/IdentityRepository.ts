import { db } from "@backend-infrastructure";
import { and, eq, isNull, ne } from "drizzle-orm";
import { LRUCache } from "lru-cache";
import type { Address } from "viem";
import { identityGroupsTable, identityNodesTable } from "../db/schema";
import type { IdentityType } from "../schemas";

type IdentityGroupSelect = typeof identityGroupsTable.$inferSelect;
type IdentityNodeSelect = typeof identityNodesTable.$inferSelect;

/**
 * Postgres transaction handle as passed to `db.transaction(async (trx) => …)`.
 * The email attach/unlink writes accept one so the verify flow can commit them
 * atomically with the challenge consumption.
 */
type PgTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type PgRunner = typeof db | PgTx;

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
     * The group's single linked (non-unlinked) email node, or `null`. The
     * single-active-email invariant — enforced on verify (`confirmEmail`) and
     * on merge (`reconcileGroupEmails`) — guarantees at most one such row, so
     * no ordering or verified-vs-oldest disambiguation is needed.
     */
    async findLinkedEmail(
        groupId: string,
        runner: PgRunner = db
    ): Promise<{ email: string; verifiedAt: Date | null } | null> {
        const [node] = await runner
            .select({
                email: identityNodesTable.identityValue,
                verifiedAt: identityNodesTable.verifiedAt,
            })
            .from(identityNodesTable)
            .where(
                and(
                    eq(identityNodesTable.groupId, groupId),
                    eq(identityNodesTable.identityType, "email"),
                    isNull(identityNodesTable.unlinkedAt)
                )
            )
            .limit(1);
        return node ?? null;
    }

    /**
     * Any email node for `email` across the whole table (linked OR unlinked),
     * regardless of group. Backs availability checks: an unlinked row still
     * occupies the global unique slot, so a previously-used address resolves
     * here and is rejected as non-reusable.
     */
    async findEmailNode(email: string): Promise<IdentityNodeSelect | null> {
        const normalizedValue = this.normalizeValue("email", email);
        const node = await db.query.identityNodesTable.findFirst({
            where: and(
                eq(identityNodesTable.identityType, "email"),
                eq(identityNodesTable.identityValue, normalizedValue),
                isNull(identityNodesTable.merchantId)
            ),
        });
        return node ?? null;
    }

    /**
     * Promote `email` to the group's single verified + linked email, inside
     * the caller's transaction.
     *
     *  - First-time verify / resend: the proven address is already the
     *    group's current linked node → just stamp `verifiedAt`.
     *  - Rotation: insert the new verified node, then soft-unlink every other
     *    linked email so exactly one active email remains (rule: single
     *    active email per group).
     *
     * Returns `false` without mutating when the address is already present
     * globally (owned by another group, or a retired node still holding the
     * unique slot) — the insert hits the unique constraint and writes nothing.
     */
    async confirmEmail(
        groupId: string,
        email: string,
        tx: PgTx
    ): Promise<boolean> {
        const normalizedValue = this.normalizeValue("email", email);
        const now = new Date();
        const current = await this.findLinkedEmail(groupId, tx);

        // First-time verify / resend: stamp the existing current node.
        if (current?.email === normalizedValue) {
            await tx
                .update(identityNodesTable)
                .set({ verifiedAt: now })
                .where(
                    and(
                        eq(identityNodesTable.groupId, groupId),
                        eq(identityNodesTable.identityType, "email"),
                        eq(identityNodesTable.identityValue, normalizedValue)
                    )
                );
            this.invalidateEmailCache(normalizedValue);
            return true;
        }

        // Rotation: the new address must be globally free. The unique
        // constraint rejects anything already present → nothing is written
        // and we report the conflict to the caller.
        const inserted = await tx
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

        // Retire every other linked email so a single active email remains.
        await tx
            .update(identityNodesTable)
            .set({ unlinkedAt: now })
            .where(
                and(
                    eq(identityNodesTable.groupId, groupId),
                    eq(identityNodesTable.identityType, "email"),
                    isNull(identityNodesTable.unlinkedAt),
                    ne(identityNodesTable.identityValue, normalizedValue)
                )
            );

        this.invalidateEmailCache(normalizedValue);
        return true;
    }

    /**
     * Enforce the single-active-email invariant on a group: keep one linked
     * email (verified first, then most recently created) and soft-unlink the
     * rest. Idempotent — a no-op when the group already has ≤1 linked email.
     * Called from the merge flow, where moving nodes onto the anchor can
     * leave it holding one linked email per merged group.
     */
    async reconcileGroupEmails(groupId: string, tx: PgTx): Promise<void> {
        const linked = await tx
            .select({
                id: identityNodesTable.id,
                verifiedAt: identityNodesTable.verifiedAt,
                createdAt: identityNodesTable.createdAt,
            })
            .from(identityNodesTable)
            .where(
                and(
                    eq(identityNodesTable.groupId, groupId),
                    eq(identityNodesTable.identityType, "email"),
                    isNull(identityNodesTable.unlinkedAt)
                )
            );

        if (linked.length <= 1) {
            return;
        }

        // Winner policy: prefer verified, then most-recent `createdAt`.
        const [winner] = [...linked].sort((a, b) => {
            const aVerified = a.verifiedAt ? 1 : 0;
            const bVerified = b.verifiedAt ? 1 : 0;
            if (aVerified !== bVerified) return bVerified - aVerified;
            return (
                (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
            );
        });

        await tx
            .update(identityNodesTable)
            .set({ unlinkedAt: new Date() })
            .where(
                and(
                    eq(identityNodesTable.groupId, groupId),
                    eq(identityNodesTable.identityType, "email"),
                    isNull(identityNodesTable.unlinkedAt),
                    ne(identityNodesTable.id, winner.id)
                )
            );
    }

    private invalidateEmailCache(normalizedEmail: string): void {
        this.identityGroupIdCache.delete(
            this.buildIdentityCacheKey("email", normalizedEmail)
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
