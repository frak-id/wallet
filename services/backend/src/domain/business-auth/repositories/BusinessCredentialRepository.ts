import { db } from "@backend-infrastructure";
import { and, eq } from "drizzle-orm";
import type { Address } from "viem";
import {
    type BusinessCredentialSelect,
    businessAccountCredentialsTable,
} from "../db/schema";

export class BusinessCredentialRepository {
    async findByAccount(
        accountId: string
    ): Promise<BusinessCredentialSelect[]> {
        return db.query.businessAccountCredentialsTable.findMany({
            where: eq(businessAccountCredentialsTable.accountId, accountId),
        });
    }

    async findByWallet(
        wallet: Address
    ): Promise<BusinessCredentialSelect | null> {
        const result = await db.query.businessAccountCredentialsTable.findFirst(
            {
                where: and(
                    eq(businessAccountCredentialsTable.type, "wallet"),
                    eq(businessAccountCredentialsTable.walletAddress, wallet)
                ),
            }
        );
        return result ?? null;
    }

    async findPasswordByAccount(
        accountId: string
    ): Promise<BusinessCredentialSelect | null> {
        const result = await db.query.businessAccountCredentialsTable.findFirst(
            {
                where: and(
                    eq(businessAccountCredentialsTable.type, "password"),
                    eq(businessAccountCredentialsTable.accountId, accountId)
                ),
            }
        );
        return result ?? null;
    }

    async createWallet(params: {
        accountId: string;
        wallet: Address;
    }): Promise<BusinessCredentialSelect> {
        const [credential] = await db
            .insert(businessAccountCredentialsTable)
            .values({
                accountId: params.accountId,
                type: "wallet",
                walletAddress: params.wallet,
            })
            .onConflictDoNothing()
            .returning();
        if (credential) return credential;
        // Conflict path — the wallet credential already exists (idempotent
        // upsert on SIWE login); fetch and return the existing row.
        const existing = await this.findByWallet(params.wallet);
        if (!existing) {
            throw new Error("Failed to create wallet credential");
        }
        return existing;
    }

    async createPassword(params: {
        accountId: string;
        passwordHash: string;
    }): Promise<BusinessCredentialSelect> {
        const [credential] = await db
            .insert(businessAccountCredentialsTable)
            .values({
                accountId: params.accountId,
                type: "password",
                passwordHash: params.passwordHash,
            })
            .returning();
        if (!credential) {
            throw new Error("Failed to create password credential");
        }
        return credential;
    }

    async updatePasswordHash(params: {
        accountId: string;
        passwordHash: string;
    }): Promise<void> {
        await db
            .update(businessAccountCredentialsTable)
            .set({ passwordHash: params.passwordHash })
            .where(
                and(
                    eq(businessAccountCredentialsTable.type, "password"),
                    eq(
                        businessAccountCredentialsTable.accountId,
                        params.accountId
                    )
                )
            );
    }
}
