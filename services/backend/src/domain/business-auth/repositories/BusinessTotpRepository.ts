import { db } from "@backend-infrastructure";
import { eq, sql } from "drizzle-orm";
import type { Hex } from "viem";
import { type BusinessTotpSelect, businessTotpTable } from "../db/schema";

export class BusinessTotpRepository {
    async findByAccount(accountId: string): Promise<BusinessTotpSelect | null> {
        const result = await db.query.businessTotpTable.findFirst({
            where: eq(businessTotpTable.accountId, accountId),
        });
        return result ?? null;
    }

    /**
     * A re-setup before activation replaces the pending secret; an activated
     * enrollment is never silently overwritten (guarded in the service).
     */
    async upsertPending(params: {
        accountId: string;
        encryptedSecret: Hex;
    }): Promise<void> {
        await db
            .insert(businessTotpTable)
            .values(params)
            .onConflictDoUpdate({
                target: businessTotpTable.accountId,
                set: {
                    encryptedSecret: params.encryptedSecret,
                    activatedAt: null,
                    recoveryCodesHash: null,
                },
            });
    }

    async activate(params: {
        accountId: string;
        recoveryCodesHash: string[];
    }): Promise<void> {
        await db
            .update(businessTotpTable)
            .set({
                activatedAt: new Date(),
                recoveryCodesHash: params.recoveryCodesHash,
            })
            .where(eq(businessTotpTable.accountId, params.accountId));
    }

    /** Single-use recovery code: remove the consumed hash from the array. */
    async consumeRecoveryCode(
        accountId: string,
        codeHash: string
    ): Promise<void> {
        await db
            .update(businessTotpTable)
            .set({
                recoveryCodesHash: sql`array_remove(${businessTotpTable.recoveryCodesHash}, ${codeHash})`,
            })
            .where(eq(businessTotpTable.accountId, accountId));
    }

    async delete(accountId: string): Promise<void> {
        await db
            .delete(businessTotpTable)
            .where(eq(businessTotpTable.accountId, accountId));
    }
}
