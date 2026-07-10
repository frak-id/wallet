import { db } from "@backend-infrastructure";
import { and, eq, sql } from "drizzle-orm";
import type { Address, Hex } from "viem";
import {
    type BusinessAccountSelect,
    businessAccountsTable,
} from "../db/schema";

/**
 * One row per business account, holding at most one credential of each
 * login method (password/shopify/wallet) and TOTP enrollment inline —
 * see the schema-level rationale in `db/schema.ts`. Absorbs what used to be
 * three repositories (account, credential, TOTP): every method here used to
 * be a join across tables, now it's a single-row read or column update.
 */
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

    async findByWallet(wallet: Address): Promise<BusinessAccountSelect | null> {
        const result = await db.query.businessAccountsTable.findFirst({
            where: eq(businessAccountsTable.walletAddress, wallet),
        });
        return result ?? null;
    }

    async findByShopifyUser(params: {
        shopifyUserId: string;
        shopDomain: string;
    }): Promise<BusinessAccountSelect | null> {
        const result = await db.query.businessAccountsTable.findFirst({
            where: and(
                eq(businessAccountsTable.shopifyUserId, params.shopifyUserId),
                eq(businessAccountsTable.shopifyShopDomain, params.shopDomain)
            ),
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

    /**
     * Idempotent: no-ops (returns the existing row) when `accountId` already
     * carries this exact wallet — the unique index on `wallet_address`
     * otherwise turns a repeat SIWE login into a constraint violation.
     */
    async setWallet(params: {
        accountId: string;
        wallet: Address;
    }): Promise<BusinessAccountSelect> {
        const [account] = await db
            .update(businessAccountsTable)
            .set({ walletAddress: params.wallet, updatedAt: new Date() })
            .where(eq(businessAccountsTable.id, params.accountId))
            .returning();
        if (!account) {
            throw new Error("Failed to set wallet on business account");
        }
        return account;
    }

    async setPasswordHash(params: {
        accountId: string;
        passwordHash: string;
    }): Promise<void> {
        await db
            .update(businessAccountsTable)
            .set({ passwordHash: params.passwordHash, updatedAt: new Date() })
            .where(eq(businessAccountsTable.id, params.accountId));
    }

    async setShopifyIdentity(params: {
        accountId: string;
        shopifyUserId: string;
        shopDomain: string;
    }): Promise<BusinessAccountSelect> {
        const [account] = await db
            .update(businessAccountsTable)
            .set({
                shopifyUserId: params.shopifyUserId,
                shopifyShopDomain: params.shopDomain,
                updatedAt: new Date(),
            })
            .where(eq(businessAccountsTable.id, params.accountId))
            .returning();
        if (!account) {
            throw new Error(
                "Failed to set shopify identity on business account"
            );
        }
        return account;
    }

    /**
     * A re-setup before activation replaces the pending secret; an activated
     * enrollment is never silently overwritten (guarded in `TotpService`).
     */
    async setPendingTotp(params: {
        accountId: string;
        encryptedSecret: Hex;
    }): Promise<void> {
        await db
            .update(businessAccountsTable)
            .set({
                totpSecretEnc: params.encryptedSecret,
                totpActivatedAt: null,
                totpRecoveryCodesHash: null,
                updatedAt: new Date(),
            })
            .where(eq(businessAccountsTable.id, params.accountId));
    }

    async activateTotp(params: {
        accountId: string;
        recoveryCodesHash: string[];
    }): Promise<void> {
        await db
            .update(businessAccountsTable)
            .set({
                totpActivatedAt: new Date(),
                totpRecoveryCodesHash: params.recoveryCodesHash,
                updatedAt: new Date(),
            })
            .where(eq(businessAccountsTable.id, params.accountId));
    }

    /** Single-use recovery code: remove the consumed hash from the array. */
    async consumeTotpRecoveryCode(
        accountId: string,
        codeHash: string
    ): Promise<void> {
        await db
            .update(businessAccountsTable)
            .set({
                totpRecoveryCodesHash: sql`array_remove(${businessAccountsTable.totpRecoveryCodesHash}, ${codeHash})`,
                updatedAt: new Date(),
            })
            .where(eq(businessAccountsTable.id, accountId));
    }

    async clearTotp(accountId: string): Promise<void> {
        await db
            .update(businessAccountsTable)
            .set({
                totpSecretEnc: null,
                totpActivatedAt: null,
                totpRecoveryCodesHash: null,
                updatedAt: new Date(),
            })
            .where(eq(businessAccountsTable.id, accountId));
    }
}
