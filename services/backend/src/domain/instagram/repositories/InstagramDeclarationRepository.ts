import { eq, inArray } from "drizzle-orm";
import { db } from "../../../infrastructure/persistence/postgres";
import {
    type InstagramDeclarationSelect,
    instagramDeclarationsTable,
} from "../db/schema";

export class InstagramDeclarationRepository {
    async findByIdentityGroup(
        identityGroupId: string
    ): Promise<InstagramDeclarationSelect | null> {
        const [declaration] = await db
            .select()
            .from(instagramDeclarationsTable)
            .where(
                eq(instagramDeclarationsTable.identityGroupId, identityGroupId)
            )
            .limit(1);
        return declaration ?? null;
    }

    async findByIdentityGroups(
        identityGroupIds: string[]
    ): Promise<InstagramDeclarationSelect[]> {
        if (identityGroupIds.length === 0) return [];
        return db
            .select()
            .from(instagramDeclarationsTable)
            .where(
                inArray(
                    instagramDeclarationsTable.identityGroupId,
                    identityGroupIds
                )
            );
    }

    async upsert(params: {
        identityGroupId: string;
        username: string;
    }): Promise<InstagramDeclarationSelect> {
        const declaredAt = new Date();
        const [saved] = await db
            .insert(instagramDeclarationsTable)
            .values({ ...params, declaredAt })
            .onConflictDoUpdate({
                target: instagramDeclarationsTable.identityGroupId,
                set: { username: params.username, declaredAt },
            })
            .returning();
        if (!saved) {
            throw new Error(
                `Failed to save the Instagram declaration of ${params.identityGroupId}`
            );
        }
        return saved;
    }

    async deleteByIdentityGroup(identityGroupId: string): Promise<void> {
        await db
            .delete(instagramDeclarationsTable)
            .where(
                eq(instagramDeclarationsTable.identityGroupId, identityGroupId)
            );
    }
}
