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

    async create(
        link: Omit<ReferralLinkInsert, "id" | "createdAt">
    ): Promise<ReferralLinkSelect | null> {
        const existing = await this.findByReferee(
            link.merchantId,
            link.refereeIdentityGroupId
        );
        if (existing) {
            return null;
        }

        const [result] = await db
            .insert(referralLinksTable)
            .values(link)
            .returning();
        return result ?? null;
    }

    async findByReferee(
        merchantId: string,
        refereeIdentityGroupId: string
    ): Promise<ReferralLinkSelect | null> {
        const [result] = await db
            .select()
            .from(referralLinksTable)
            .where(
                and(
                    eq(referralLinksTable.merchantId, merchantId),
                    eq(
                        referralLinksTable.refereeIdentityGroupId,
                        refereeIdentityGroupId
                    )
                )
            )
            .limit(1);

        return result ?? null;
    }

    /**
     * Walk the referral chain upward from startIdentityGroupId in a single
     * recursive CTE query. Returns the chain with built-in cycle detection
     * (path-based) so corrupted data never causes infinite traversal.
     *
     * Uses the UNIQUE(merchant_id, referee_identity_group_id) index for
     * both the anchor and recursive join — single index scan per level.
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
                    referrer_identity_group_id AS identity_group_id,
                    1 AS depth,
                    ARRAY[referee_identity_group_id, referrer_identity_group_id] AS path
                FROM referral_links
                WHERE merchant_id = ${merchantId}
                  AND referee_identity_group_id = ${startIdentityGroupId}

                UNION ALL

                SELECT
                    rl.referrer_identity_group_id,
                    c.depth + 1,
                    c.path || rl.referrer_identity_group_id
                FROM referral_links rl
                INNER JOIN chain c ON rl.referee_identity_group_id = c.identity_group_id
                WHERE rl.merchant_id = ${merchantId}
                  AND c.depth < ${maxDepth}
                  AND NOT rl.referrer_identity_group_id = ANY(c.path)
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
     * Check if creating a link (referrer → referee) would form a cycle.
     * Uses a recursive CTE with NO depth ceiling — explores the full chain
     * from the proposed referrer upward. Path-based cycle detection ensures
     * termination even with corrupted data.
     *
     * Uses EXISTS for early termination — PostgreSQL stops scanning as
     * soon as the referee is found in the referrer's upstream chain.
     */
    async wouldCreateCycle(
        merchantId: string,
        referrerIdentityGroupId: string,
        refereeIdentityGroupId: string
    ): Promise<boolean> {
        const result = await db.execute<{ would_cycle: boolean }>(sql`
            WITH RECURSIVE chain AS (
                SELECT
                    referrer_identity_group_id AS identity_group_id,
                    ARRAY[referee_identity_group_id, referrer_identity_group_id] AS path
                FROM referral_links
                WHERE merchant_id = ${merchantId}
                  AND referee_identity_group_id = ${referrerIdentityGroupId}

                UNION ALL

                SELECT
                    rl.referrer_identity_group_id,
                    c.path || rl.referrer_identity_group_id
                FROM referral_links rl
                INNER JOIN chain c ON rl.referee_identity_group_id = c.identity_group_id
                WHERE rl.merchant_id = ${merchantId}
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
