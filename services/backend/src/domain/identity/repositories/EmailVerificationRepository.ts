import { db } from "@backend-infrastructure";
import { eq, lt, sql } from "drizzle-orm";
import {
    type EmailVerificationCodeSelect,
    emailVerificationCodesTable,
} from "../db/schema";

export class EmailVerificationRepository {
    async findByGroup(
        groupId: string
    ): Promise<EmailVerificationCodeSelect | null> {
        const result = await db.query.emailVerificationCodesTable.findFirst({
            where: eq(emailVerificationCodesTable.groupId, groupId),
        });
        return result ?? null;
    }

    /**
     * One challenge per group: a resend reuses the row, resetting the target
     * email, code, expiry and attempt counter and clearing any prior
     * consumption while stamping `last_sent_at` for the debounce window.
     */
    async upsert(params: {
        groupId: string;
        email: string;
        code: string;
        expiresAt: Date;
    }): Promise<EmailVerificationCodeSelect> {
        const [result] = await db
            .insert(emailVerificationCodesTable)
            .values({
                groupId: params.groupId,
                email: params.email,
                code: params.code,
                expiresAt: params.expiresAt,
            })
            .onConflictDoUpdate({
                target: emailVerificationCodesTable.groupId,
                set: {
                    email: params.email,
                    code: params.code,
                    expiresAt: params.expiresAt,
                    lastSentAt: new Date(),
                    attempts: 0,
                    consumedAt: null,
                },
            })
            .returning();
        if (!result) {
            throw new Error("Failed to upsert email verification code");
        }
        return result;
    }

    async incrementAttempts(groupId: string): Promise<void> {
        await db
            .update(emailVerificationCodesTable)
            .set({ attempts: sql`${emailVerificationCodesTable.attempts} + 1` })
            .where(eq(emailVerificationCodesTable.groupId, groupId));
    }

    async consume(groupId: string): Promise<void> {
        await db
            .update(emailVerificationCodesTable)
            .set({ consumedAt: new Date() })
            .where(eq(emailVerificationCodesTable.groupId, groupId));
    }

    async deleteExpired(): Promise<number> {
        const result = await db
            .delete(emailVerificationCodesTable)
            .where(lt(emailVerificationCodesTable.expiresAt, new Date()));
        return result.length;
    }
}
