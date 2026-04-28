import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { LRUCache } from "lru-cache";
import { db } from "../../../infrastructure/persistence/postgres";
import {
    type ReferralLinkInsert,
    type ReferralLinkSelect,
    referralLinksTable,
} from "../db/schema";
import type { ReferralLinkEndReason } from "../schemas/index";

type ReferralChainItem = {
    identityGroupId: string;
    depth: number;
};

// Active-row predicate reused everywhere we read referral_links. Forget the
// soft-delete check and the chain walker silently includes inactive edges.
const isActive = sql`"removed_at" IS NULL`;

export class ReferralLinkRepository {
    /**
     * Cache full chain results keyed by `merchant:start:maxDepth`.
     *
     * Used only by `findChain` (read path during reward distribution),
     * NOT by `wouldCreateCycle` (write path — needs fresh data).
     *
     * Invalidation: `create` and `removeReferrer` flush the entire cache.
     * Per-key invalidation would require a reverse index from
     * `(referrer, referee)` to all chain keys that include them — not worth
     * the bookkeeping for an event that's rare relative to reads. Bulk
     * mutations done outside the repository (e.g. `IdentityMergeService`)
     * remain bounded by the TTL.
     */
    private readonly chainCache = new LRUCache<string, ReferralChainItem[]>({
        max: 1024,
        ttl: 10 * 60 * 1000,
    });

    clearChainCache(): void {
        this.chainCache.clear();
    }

    /**
     * Insert a referral link row. Returns null when a unique constraint
     * rejects the insert — the partial-unique indexes on `referral_links`
     * enforce "first referrer wins" per-merchant (scope=merchant) and once
     * globally (scope=cross_merchant). Callers map null to their own
     * already-exists error code.
     *
     * Callers may omit `scope` / `source` — the schema defaults to
     * `scope='merchant'` and `source='link'`, which matches the arrival-link
     * referral flow driven by `ArrivalHandler`.
     */
    async create(
        link: Omit<ReferralLinkInsert, "id" | "createdAt">
    ): Promise<ReferralLinkSelect | null> {
        const [result] = await db
            .insert(referralLinksTable)
            .values(link)
            .onConflictDoNothing()
            .returning();
        if (result) this.chainCache.clear();
        return result ?? null;
    }

    async findById(id: string): Promise<ReferralLinkSelect | null> {
        const [result] = await db
            .select()
            .from(referralLinksTable)
            .where(eq(referralLinksTable.id, id))
            .limit(1);
        return result ?? null;
    }

    async findManyByIds(ids: string[]): Promise<ReferralLinkSelect[]> {
        if (ids.length === 0) return [];
        return db
            .select()
            .from(referralLinksTable)
            .where(inArray(referralLinksTable.id, ids));
    }

    /**
     * Look up the active referral link for a given scope.
     *
     * - `scope='merchant'` requires a non-null `merchantId`.
     * - `scope='cross_merchant'` ignores `merchantId` entirely.
     *
     * Soft-deleted (`removed_at IS NOT NULL`) rows are excluded. Use
     * `findById` / `findManyByIds` to retrieve historical (inactive) rows.
     */
    async findByReferee(params: {
        merchantId: string | null;
        refereeIdentityGroupId: string;
        scope: "merchant" | "cross_merchant";
    }): Promise<ReferralLinkSelect | null> {
        const { merchantId, refereeIdentityGroupId, scope } = params;

        if (scope === "merchant" && !merchantId) {
            return null;
        }

        const [result] = await db
            .select()
            .from(referralLinksTable)
            .where(
                and(
                    eq(referralLinksTable.scope, scope),
                    eq(
                        referralLinksTable.refereeIdentityGroupId,
                        refereeIdentityGroupId
                    ),
                    scope === "merchant"
                        ? eq(
                              referralLinksTable.merchantId,
                              merchantId as string
                          )
                        : sql`"merchant_id" IS NULL`,
                    isActive
                )
            )
            .limit(1);

        return result ?? null;
    }

    /**
     * Effective referrer resolver used by the reward pipeline.
     *
     * Merchant-scoped referrer shadows the cross-merchant one when both
     * exist. This is the "erase by direct" rule: a per-merchant referrer
     * (set via referral link) takes precedence for that merchant's reward
     * distribution.
     *
     * Single query — scans both scopes in one pass and orders merchant rows
     * first so `LIMIT 1` picks the winner. Hot path: runs on every reward
     * event. Inactive rows (`removed_at IS NOT NULL`) are filtered out via
     * the shared `isActive` predicate.
     */
    async findReferrerForReferee(
        merchantId: string,
        refereeIdentityGroupId: string
    ): Promise<ReferralLinkSelect | null> {
        const [result] = await db
            .select()
            .from(referralLinksTable)
            .where(
                and(
                    eq(
                        referralLinksTable.refereeIdentityGroupId,
                        refereeIdentityGroupId
                    ),
                    sql`(
                        ("scope" = 'merchant' AND "merchant_id" = ${merchantId}::uuid)
                        OR "scope" = 'cross_merchant'
                    )`,
                    isActive
                )
            )
            .orderBy(sql`("scope" = 'merchant') DESC`)
            .limit(1);
        return result ?? null;
    }

    /**
     * Walk the referral chain upward from startIdentityGroupId in a single
     * recursive CTE query. Returns the chain with built-in cycle detection
     * (path-based) so corrupted data never causes infinite traversal.
     *
     * Unified walker: at every level, merchant-scoped links (for this
     * merchant) are preferred over cross-merchant links. `LATERAL` +
     * `LIMIT 1` keeps the chain linear and deterministic.
     *
     * Soft-deleted rows are excluded via `removed_at IS NULL`.
     */
    async findChain(
        merchantId: string,
        startIdentityGroupId: string,
        maxDepth: number
    ): Promise<ReferralChainItem[]> {
        const cacheKey = `${merchantId}:${startIdentityGroupId}:${maxDepth}`;
        const cached = this.chainCache.get(cacheKey);
        if (cached) return cached;

        const result = await db.execute<{
            identity_group_id: string;
            depth: number;
        }>(sql`
            WITH RECURSIVE chain AS (
                SELECT
                    anchor.referrer_identity_group_id AS identity_group_id,
                    1 AS depth,
                    ARRAY[anchor.referee_identity_group_id, anchor.referrer_identity_group_id] AS path
                FROM (
                    SELECT *
                    FROM referral_links
                    WHERE referee_identity_group_id = ${startIdentityGroupId}
                      AND (
                          (scope = 'merchant' AND merchant_id = ${merchantId}::uuid)
                          OR scope = 'cross_merchant'
                      )
                      AND removed_at IS NULL
                    ORDER BY (scope = 'merchant') DESC
                    LIMIT 1
                ) anchor

                UNION ALL

                SELECT
                    next.referrer_identity_group_id,
                    c.depth + 1,
                    c.path || next.referrer_identity_group_id
                FROM chain c
                JOIN LATERAL (
                    SELECT *
                    FROM referral_links rl
                    WHERE rl.referee_identity_group_id = c.identity_group_id
                      AND (
                          (rl.scope = 'merchant' AND rl.merchant_id = ${merchantId}::uuid)
                          OR rl.scope = 'cross_merchant'
                      )
                      AND rl.removed_at IS NULL
                      AND NOT rl.referrer_identity_group_id = ANY(c.path)
                    ORDER BY (rl.scope = 'merchant') DESC
                    LIMIT 1
                ) next ON TRUE
                WHERE c.depth < ${maxDepth}
            )
            SELECT identity_group_id, depth FROM chain
            ORDER BY depth
        `);

        const chain = [...result].map((row) => ({
            identityGroupId: row.identity_group_id,
            depth: row.depth,
        }));

        this.chainCache.set(cacheKey, chain);
        return chain;
    }

    /**
     * Scope-agnostic cycle check. Treats the full referral graph (merchant
     * + cross-merchant) as one so inserting (X → Y) of any scope is rejected
     * if a path Y → … → X exists anywhere. Conservative, cheap, and avoids
     * cross-scope loops (A → B via merchant, B → A via code) that would
     * otherwise be reachable through the unified chain walker.
     */
    async wouldCreateCycle(
        referrerIdentityGroupId: string,
        refereeIdentityGroupId: string
    ): Promise<boolean> {
        const result = await db.execute<{ would_cycle: boolean }>(sql`
            WITH RECURSIVE chain AS (
                SELECT
                    referrer_identity_group_id AS identity_group_id,
                    ARRAY[referee_identity_group_id, referrer_identity_group_id] AS path
                FROM referral_links
                WHERE referee_identity_group_id = ${referrerIdentityGroupId}
                  AND removed_at IS NULL

                UNION ALL

                SELECT
                    rl.referrer_identity_group_id,
                    c.path || rl.referrer_identity_group_id
                FROM referral_links rl
                INNER JOIN chain c ON rl.referee_identity_group_id = c.identity_group_id
                WHERE rl.removed_at IS NULL
                  AND NOT rl.referrer_identity_group_id = ANY(c.path)
            )
            SELECT EXISTS (
                SELECT 1 FROM chain
                WHERE identity_group_id = ${refereeIdentityGroupId}
            ) AS would_cycle
        `);

        return [...result][0]?.would_cycle ?? false;
    }

    /**
     * Soft-delete the active referral link for the given (referee, scope,
     * merchantId). Sets `removed_at = now()` and stamps `end_reason` so the
     * lifecycle is reconstructible from the row alone (audit trail) without
     * losing FK pointers used by `asset_logs.referral_link_id` or by the
     * referee’s historical attribution.
     *
     * Returns the soft-deleted row, or null when there is nothing active to
     * remove (lets callers map to a 404).
     */
    async removeReferrer(params: {
        merchantId: string | null;
        refereeIdentityGroupId: string;
        scope: "merchant" | "cross_merchant";
        reason: ReferralLinkEndReason;
    }): Promise<ReferralLinkSelect | null> {
        const { merchantId, refereeIdentityGroupId, scope, reason } = params;

        if (scope === "merchant" && !merchantId) {
            return null;
        }

        const [result] = await db
            .update(referralLinksTable)
            .set({ removedAt: new Date(), endReason: reason })
            .where(
                and(
                    eq(referralLinksTable.scope, scope),
                    eq(
                        referralLinksTable.refereeIdentityGroupId,
                        refereeIdentityGroupId
                    ),
                    scope === "merchant"
                        ? eq(
                              referralLinksTable.merchantId,
                              merchantId as string
                          )
                        : isNull(referralLinksTable.merchantId),
                    isNull(referralLinksTable.removedAt)
                )
            )
            .returning();
        if (result) this.chainCache.clear();
        return result ?? null;
    }
}
