import { db } from "@backend-infrastructure";
import { eq, lt, sql } from "drizzle-orm";
import {
    type EmailVerificationCodeSelect,
    emailVerificationCodesTable,
} from "../db/schema";

/**
 * Postgres transaction handle as passed to `db.transaction(async (trx) => …)`.
 * `consume` accepts one so it can commit atomically with the identity-graph
 * writes the verify flow performs alongside it.
 */
type PgTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type PgRunner = typeof db | PgTx;

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

    async consume(groupId: string, tx?: PgTx): Promise<void> {
        const runner: PgRunner = tx ?? db;
        await runner
            .update(emailVerificationCodesTable)
            .set({ consumedAt: new Date() })
            .where(eq(emailVerificationCodesTable.groupId, groupId));
    }

    async deleteExpired(): Promise<void> {
        await db
            .delete(emailVerificationCodesTable)
            .where(lt(emailVerificationCodesTable.expiresAt, new Date()));
    }
}
