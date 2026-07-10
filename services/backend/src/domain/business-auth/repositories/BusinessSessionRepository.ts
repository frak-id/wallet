import { db } from "@backend-infrastructure";
import { and, eq, lt } from "drizzle-orm";
import {
    type BusinessAuthMethod,
    type BusinessSessionSelect,
    businessSessionsTable,
} from "../db/schema";

export class BusinessSessionRepository {
    async findById(id: string): Promise<BusinessSessionSelect | null> {
        const result = await db.query.businessSessionsTable.findFirst({
            where: eq(businessSessionsTable.id, id),
        });
        return result ?? null;
    }

    async findByAccount(accountId: string): Promise<BusinessSessionSelect[]> {
        return db.query.businessSessionsTable.findMany({
            where: eq(businessSessionsTable.accountId, accountId),
        });
    }

    async create(params: {
        id: string;
        accountId: string;
        authMethod: BusinessAuthMethod;
        expiresAt: Date;
        twoFactorVerifiedAt?: Date;
        ip?: string;
        userAgent?: string;
    }): Promise<BusinessSessionSelect> {
        const [session] = await db
            .insert(businessSessionsTable)
            .values(params)
            .returning();
        if (!session) {
            throw new Error("Failed to create business session");
        }
        return session;
    }

    /** Sliding-expiry touch: refresh `last_used_at` + push `expires_at`. */
    async touch(id: string, expiresAt: Date): Promise<void> {
        await db
            .update(businessSessionsTable)
            .set({ lastUsedAt: new Date(), expiresAt })
            .where(eq(businessSessionsTable.id, id));
    }

    async setTwoFactorVerified(id: string, at: Date): Promise<void> {
        await db
            .update(businessSessionsTable)
            .set({ twoFactorVerifiedAt: at, twoFactorNonce: null })
            .where(eq(businessSessionsTable.id, id));
    }

    async setTwoFactorNonce(id: string, nonce: string): Promise<void> {
        await db
            .update(businessSessionsTable)
            .set({ twoFactorNonce: nonce })
            .where(eq(businessSessionsTable.id, id));
    }

    async revoke(id: string): Promise<void> {
        await db
            .delete(businessSessionsTable)
            .where(eq(businessSessionsTable.id, id));
    }

    /** Revoke a session by id, scoped to an account (session management UI). */
    async revokeForAccount(id: string, accountId: string): Promise<void> {
        await db
            .delete(businessSessionsTable)
            .where(
                and(
                    eq(businessSessionsTable.id, id),
                    eq(businessSessionsTable.accountId, accountId)
                )
            );
    }

    async deleteExpired(): Promise<void> {
        await db
            .delete(businessSessionsTable)
            .where(lt(businessSessionsTable.expiresAt, new Date()));
    }
}
