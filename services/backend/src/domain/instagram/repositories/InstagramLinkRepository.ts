import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../../infrastructure/persistence/postgres";
import {
    type InstagramLinkInsert,
    type InstagramLinkSelect,
    instagramLinksTable,
    instagramPendingLinksTable,
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
     * Replaces the group's link and drops its pending row (declaration and code)
     * in one transaction, only if that row still holds `code`: null when the
     * code is already used. A unique violation means the `igsid` belongs to
     * another group.
     */
    async certify(
        link: InstagramLinkInsert,
        code: string
    ): Promise<InstagramLinkSelect | null> {
        const pending = instagramPendingLinksTable;
        return db.transaction(async (tx) => {
            const dropped = await tx
                .delete(pending)
                .where(
                    and(
                        eq(pending.identityGroupId, link.identityGroupId),
                        eq(pending.code, code)
                    )
                )
                .returning({ id: pending.id });
            if (dropped.length === 0) return null;
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
}
