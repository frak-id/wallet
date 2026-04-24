import { and, eq, sql } from "drizzle-orm";
import { LRUCache } from "lru-cache";
import { db } from "../../../infrastructure/persistence/postgres";
import {
    type ReferralLinkInsert,
    type ReferralLinkSelect,
    referralLinksTable,
} from "../db/schema";

type ReferralChainItem = {
    identityGroupId: string;
    depth: number;
};

export class ReferralLinkRepository {
    /**
     * Cache full chain results keyed by merchant:start:maxDepth.
     * Only used for findChain (read path during reward distribution),
     * NOT for wouldCreateCycle (write path — needs fresh data).
     */
    private readonly chainCache = new LRUCache<string, ReferralChainItem[]>({
        max: 1024,
        ttl: 10 * 60 * 1000,
    });

    /**
     * Insert a referral link row. If a row already exists for the same
     * (scope, merchantId, referee) combination, returns null — "first
     * referrer wins" is the product rule.
     *
     * Callers may omit `scope` / `source` — the schema defaults to
     * `scope='merchant'` and `source='link'`, which matches the existing
     * touchpoint-driven referral flow.
     */
    async create(
        link: Omit<ReferralLinkInsert, "id" | "createdAt">
    ): Promise<ReferralLinkSelect | null> {
        const scope = link.scope ?? "merchant";

        const existing = await this.findByReferee({
            merchantId: link.merchantId ?? null,
            refereeIdentityGroupId: link.refereeIdentityGroupId,
            scope,
        });
        if (existing) {
            return null;
        }

        const [result] = await db
            .insert(referralLinksTable)
            .values(link)
            .returning();
        return result ?? null;
    }

    /**
     * Look up the active referral link for a given scope.
     *
     * - `scope='merchant'` requires a non-null `merchantId`.
     * - `scope='cross_merchant'` ignores `merchantId` entirely.
     *
     * Both queries honour the `expiresAt` Phase 2 hook.
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
                    sql`("expires_at" IS NULL OR "expires_at" > now())`
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
     * (set via touchpoint / referral link) takes precedence for that
     * merchant's reward distribution.
     */
    async findReferrerForReferee(
        merchantId: string,
        refereeIdentityGroupId: string
    ): Promise<ReferralLinkSelect | null> {
        const merchantReferrer = await this.findByReferee({
            merchantId,
            refereeIdentityGroupId,
            scope: "merchant",
        });
        if (merchantReferrer) return merchantReferrer;

        return this.findByReferee({
            merchantId: null,
            refereeIdentityGroupId,
            scope: "cross_merchant",
        });
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
     * `expires_at` is honoured for Phase 2 forward compatibility.
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
                      AND (expires_at IS NULL OR expires_at > now())
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
                      AND (rl.expires_at IS NULL OR rl.expires_at > now())
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
                  AND (expires_at IS NULL OR expires_at > now())

                UNION ALL

                SELECT
                    rl.referrer_identity_group_id,
                    c.path || rl.referrer_identity_group_id
                FROM referral_links rl
                INNER JOIN chain c ON rl.referee_identity_group_id = c.identity_group_id
                WHERE (rl.expires_at IS NULL OR rl.expires_at > now())
                  AND NOT rl.referrer_identity_group_id = ANY(c.path)
            )
            SELECT EXISTS (
                SELECT 1 FROM chain
                WHERE identity_group_id = ${refereeIdentityGroupId}
            ) AS would_cycle
        `);

        return [...result][0]?.would_cycle ?? false;
    }
}
