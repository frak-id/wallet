import { db } from "@backend-infrastructure";
import { eq } from "drizzle-orm";
import {
    type BusinessAccountSelect,
    businessAccountsTable,
} from "../db/schema";

export class BusinessAccountRepository {
    async findById(id: string): Promise<BusinessAccountSelect | null> {
        const result = await db.query.businessAccountsTable.findFirst({
            where: eq(businessAccountsTable.id, id),
        });
        return result ?? null;
    }

    async findByEmail(email: string): Promise<BusinessAccountSelect | null> {
        const result = await db.query.businessAccountsTable.findFirst({
            where: eq(businessAccountsTable.email, email.toLowerCase()),
        });
        return result ?? null;
    }

    async create(params: {
        email?: string;
        displayName?: string;
    }): Promise<BusinessAccountSelect> {
        const [account] = await db
            .insert(businessAccountsTable)
            .values({
                email: params.email?.toLowerCase(),
                displayName: params.displayName,
            })
            .returning();
        if (!account) {
            throw new Error("Failed to create business account");
        }
        return account;
    }

    async markEmailVerified(accountId: string): Promise<void> {
        await db
            .update(businessAccountsTable)
            .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
            .where(eq(businessAccountsTable.id, accountId));
    }

    async setEmail(accountId: string, email: string): Promise<void> {
        await db
            .update(businessAccountsTable)
            .set({
                email: email.toLowerCase(),
                emailVerifiedAt: null,
                updatedAt: new Date(),
            })
            .where(eq(businessAccountsTable.id, accountId));
    }
}
