import { db } from "@backend-infrastructure";
import { eq } from "drizzle-orm";
import { type RecoveryBlobSelect, recoveryBlobsTable } from "../db/schema";

export class RecoveryRepository {
    async findByGroup(groupId: string): Promise<RecoveryBlobSelect | null> {
        const result = await db.query.recoveryBlobsTable.findFirst({
            where: eq(recoveryBlobsTable.groupId, groupId),
        });
        return result ?? null;
    }

    /**
     * Upsert the encrypted blob for a group (`group_id` is unique). Setup inserts
     * the first blob; a recovery refresh that mints a fresh burner replaces it,
     * stamping `updated_at`. The blob is opaque ciphertext either way.
     */
    async save(params: {
        groupId: string;
        blob: string;
    }): Promise<RecoveryBlobSelect> {
        const [result] = await db
            .insert(recoveryBlobsTable)
            .values({ groupId: params.groupId, blob: params.blob })
            .onConflictDoUpdate({
                target: recoveryBlobsTable.groupId,
                set: { blob: params.blob, updatedAt: new Date() },
            })
            .returning();
        return result;
    }

    async deleteByGroup(groupId: string): Promise<void> {
        await db
            .delete(recoveryBlobsTable)
            .where(eq(recoveryBlobsTable.groupId, groupId));
    }
}
