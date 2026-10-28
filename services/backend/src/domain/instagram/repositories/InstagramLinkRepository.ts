import { eq, inArray } from "drizzle-orm";
import { db } from "../../../infrastructure/persistence/postgres";
import {
    type InstagramLinkInsert,
    type InstagramLinkSelect,
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

    /** Replaces the identity group's link; a unique violation means the `igsid` belongs to another group. */
    async upsert(link: InstagramLinkInsert): Promise<InstagramLinkSelect> {
        const [saved] = await db
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
    }

    /** Stores what Meta reports now; `null` when the link was removed meanwhile. */
    async refreshProfile(
        id: string,
        profile: Pick<InstagramLinkSelect, "username" | "follows" | "checkedAt">
    ): Promise<InstagramLinkSelect | null> {
        const [saved] = await db
            .update(instagramLinksTable)
            .set(profile)
            .where(eq(instagramLinksTable.id, id))
            .returning();
        return saved ?? null;
    }

    async deleteByIdentityGroup(identityGroupId: string): Promise<void> {
        await db
            .delete(instagramLinksTable)
            .where(eq(instagramLinksTable.identityGroupId, identityGroupId));
    }
}
