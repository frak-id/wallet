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
     * Insert the encrypted blob for a group. Returns `null` when a blob already
     * exists (`group_id` is unique): the setup flow is insert-only, so callers
     * treat a conflict as "already configured" rather than silently overwriting.
     */
    async save(params: {
        groupId: string;
        blob: string;
    }): Promise<RecoveryBlobSelect | null> {
        const [result] = await db
            .insert(recoveryBlobsTable)
            .values({ groupId: params.groupId, blob: params.blob })
            .onConflictDoNothing({ target: recoveryBlobsTable.groupId })
            .returning();
        return result ?? null;
    }
}
