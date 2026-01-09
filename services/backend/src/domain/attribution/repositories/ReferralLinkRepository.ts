import { and, eq } from "drizzle-orm";
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
        let currentId = startIdentityGroupId;
        let depth = 0;

        while (depth < maxDepth) {
            const link = await this.findByReferee(merchantId, currentId);
            if (!link) break;

            depth++;
            chain.push({
                identityGroupId: link.referrerIdentityGroupId,
                depth,
            });
            currentId = link.referrerIdentityGroupId;
        }

        return chain;
    }

    async findByReferrer(
        merchantId: string,
        referrerIdentityGroupId: string
    ): Promise<ReferralLinkSelect[]> {
        return db
            .select()
            .from(referralLinksTable)
            .where(
                and(
                    eq(referralLinksTable.merchantId, merchantId),
                    eq(
                        referralLinksTable.referrerIdentityGroupId,
                        referrerIdentityGroupId
                    )
                )
            );
    }

    async delete(
        merchantId: string,
        refereeIdentityGroupId: string
    ): Promise<boolean> {
        const result = await db
            .delete(referralLinksTable)
            .where(
                and(
                    eq(referralLinksTable.merchantId, merchantId),
                    eq(
                        referralLinksTable.refereeIdentityGroupId,
                        refereeIdentityGroupId
                    )
                )
            )
            .returning({ id: referralLinksTable.id });
        return result.length > 0;
    }
}
