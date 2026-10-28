import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../../infrastructure/persistence/postgres";
import {
    type InstagramLinkInsert,
    type InstagramLinkSelect,
    instagramDeclarationsTable,
    instagramLinkCodesTable,
    instagramLinksTable,
} from "../db/schema";

export class InstagramLinkRepository {
    async findByIdentityGroup(
        identityGroupId: string
    ): Promise<InstagramLinkSelect | null> {
        const [link] = await db
            .select()
            .from(instagramLinksTable)
            .where(eq(instagramLinksTable.identityGroupId, identityGroupId))
            .limit(1);
        return link ?? null;
    }

    async findByIdentityGroups(
        identityGroupIds: string[]
    ): Promise<InstagramLinkSelect[]> {
        if (identityGroupIds.length === 0) return [];
        return db
            .select()
            .from(instagramLinksTable)
            .where(
                inArray(instagramLinksTable.identityGroupId, identityGroupIds)
            );
    }

    /**
     * Replaces the group's link and drops its declaration in one transaction,
     * first claiming `codeId` when given: null when that code is already gone.
     * A unique violation means the `igsid` belongs to another group.
     */
    async certify(
        link: InstagramLinkInsert,
        codeId?: string
    ): Promise<InstagramLinkSelect | null> {
        return db.transaction(async (tx) => {
            if (codeId) {
                const [claimed] = await tx
                    .delete(instagramLinkCodesTable)
                    .where(eq(instagramLinkCodesTable.id, codeId))
                    .returning({ id: instagramLinkCodesTable.id });
                if (!claimed) return null;
            }
            const [saved] = await tx
                .insert(instagramLinksTable)
                .values(link)
                .onConflictDoUpdate({
                    target: instagramLinksTable.identityGroupId,
                    set: {
                        igsid: link.igsid,
                        username: link.username,
                        follows: link.follows,
                        checkedAt: link.checkedAt,
                    },
                })
                .returning();
            if (!saved) {
                throw new Error(
                    `Failed to save the Instagram link of ${link.identityGroupId}`
                );
            }
            await tx
                .delete(instagramDeclarationsTable)
                .where(
                    eq(
                        instagramDeclarationsTable.identityGroupId,
                        link.identityGroupId
                    )
                );
            return saved;
        });
    }

    /** Stores what Meta reports now; `null` when the link was removed or moved to another account meanwhile. */
    async refreshProfile(
        link: Pick<InstagramLinkSelect, "id" | "igsid">,
        profile: Pick<InstagramLinkSelect, "username" | "follows" | "checkedAt">
    ): Promise<InstagramLinkSelect | null> {
        const [saved] = await db
            .update(instagramLinksTable)
            .set(profile)
            .where(
                and(
                    eq(instagramLinksTable.id, link.id),
                    eq(instagramLinksTable.igsid, link.igsid)
                )
            )
            .returning();
        return saved ?? null;
    }

    async deleteByIdentityGroup(identityGroupId: string): Promise<void> {
        await db
            .delete(instagramLinksTable)
            .where(eq(instagramLinksTable.identityGroupId, identityGroupId));
    }
}
