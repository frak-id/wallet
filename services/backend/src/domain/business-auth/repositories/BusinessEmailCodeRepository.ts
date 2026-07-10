import { db } from "@backend-infrastructure";
import { and, eq, lt, sql } from "drizzle-orm";
import {
    type BusinessEmailCodePurpose,
    type BusinessEmailCodeSelect,
    businessEmailCodesTable,
} from "../db/schema";

export class BusinessEmailCodeRepository {
    async find(
        accountId: string,
        purpose: BusinessEmailCodePurpose
    ): Promise<BusinessEmailCodeSelect | null> {
        const result = await db.query.businessEmailCodesTable.findFirst({
            where: and(
                eq(businessEmailCodesTable.accountId, accountId),
                eq(businessEmailCodesTable.purpose, purpose)
            ),
        });
        return result ?? null;
    }

    /**
     * One challenge per (account, purpose): a resend reuses the row, resetting
     * the code hash, expiry and attempt counter, and stamping `last_sent_at`
     * for the debounce window.
     */
    async upsert(params: {
        accountId: string;
        purpose: BusinessEmailCodePurpose;
        codeHash: string;
        expiresAt: Date;
    }): Promise<void> {
        await db
            .insert(businessEmailCodesTable)
            .values(params)
            .onConflictDoUpdate({
                target: [
                    businessEmailCodesTable.accountId,
                    businessEmailCodesTable.purpose,
                ],
                set: {
                    codeHash: params.codeHash,
                    expiresAt: params.expiresAt,
                    lastSentAt: new Date(),
                    attempts: 0,
                    consumedAt: null,
                },
            });
    }

    async incrementAttempts(
        accountId: string,
        purpose: BusinessEmailCodePurpose
    ): Promise<void> {
        await db
            .update(businessEmailCodesTable)
            .set({ attempts: sql`${businessEmailCodesTable.attempts} + 1` })
            .where(
                and(
                    eq(businessEmailCodesTable.accountId, accountId),
                    eq(businessEmailCodesTable.purpose, purpose)
                )
            );
    }

    async consume(
        accountId: string,
        purpose: BusinessEmailCodePurpose
    ): Promise<void> {
        await db
            .update(businessEmailCodesTable)
            .set({ consumedAt: new Date() })
            .where(
                and(
                    eq(businessEmailCodesTable.accountId, accountId),
                    eq(businessEmailCodesTable.purpose, purpose)
                )
            );
    }

    async deleteExpired(): Promise<void> {
        await db
            .delete(businessEmailCodesTable)
            .where(lt(businessEmailCodesTable.expiresAt, new Date()));
    }
}
