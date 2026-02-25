import { and, eq } from "drizzle-orm";
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
    private readonly referrerCache = new LRUCache<
        string,
        { referrerId: string | null }
    >({
        max: 4096,
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

    async findChain(
        merchantId: string,
        startIdentityGroupId: string,
        maxDepth: number
    ): Promise<ReferralChainItem[]> {
        const chain: ReferralChainItem[] = [];
        const visited = new Set<string>([startIdentityGroupId]);
        let currentId = startIdentityGroupId;
        let depth = 0;

        while (depth < maxDepth) {
            const cacheKey = `${merchantId}:${currentId}`;
            const cached = this.referrerCache.get(cacheKey);

            let referrerId: string | null;
            if (cached !== undefined) {
                referrerId = cached.referrerId;
            } else {
                const link = await this.findByReferee(merchantId, currentId);
                referrerId = link?.referrerIdentityGroupId ?? null;
                this.referrerCache.set(cacheKey, { referrerId });
            }

            if (!referrerId) break;

            // Cycle detected in existing data — stop traversal
            if (visited.has(referrerId)) break;
            visited.add(referrerId);

            depth++;
            chain.push({ identityGroupId: referrerId, depth });
            currentId = referrerId;
        }

        return chain;
    }

    /**
     * Check if creating a link (referrer → referee) would form a cycle.
     * Walks the chain upward from the proposed referrer — if the proposed
     * referee appears anywhere in that chain, a cycle would be created.
     */
    async wouldCreateCycle(
        merchantId: string,
        referrerIdentityGroupId: string,
        refereeIdentityGroupId: string,
        maxDepth: number
    ): Promise<boolean> {
        const chain = await this.findChain(
            merchantId,
            referrerIdentityGroupId,
            maxDepth
        );
        return chain.some(
            (member) => member.identityGroupId === refereeIdentityGroupId
        );
    }
}
