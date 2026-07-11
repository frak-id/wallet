import { db } from "@backend-infrastructure";
import { and, eq, isNull, sql } from "drizzle-orm";
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

    /**
     * Atomically create an account already carrying `wallet`, in a single
     * `INSERT ... ON CONFLICT DO NOTHING` on the partial wallet unique index.
     * Returns `null` when the wallet already belongs to an account (the
     * caller resolves the winner) — crucially, no orphan account row is left
     * behind, unlike a create-then-set-wallet pair (plan §1.5 / M4).
     */
    async insertWalletAccount(params: {
        wallet: Address;
    }): Promise<BusinessAccountSelect | null> {
        const [account] = await db
            .insert(businessAccountsTable)
            .values({ walletAddress: params.wallet })
            .onConflictDoNothing({
                target: businessAccountsTable.walletAddress,
                where: sql`wallet_address IS NOT NULL`,
            })
            .returning();
        return account ?? null;
    }

    /**
     * Atomically create an account already carrying the Shopify staff
     * identity, `ON CONFLICT DO NOTHING` on the partial shopify-identity
     * unique index. Returns `null` on an identity conflict (caller resolves
     * the winner). The optional `email` prefill is NOT part of the conflict
     * target, so a concurrent email claim surfaces as a unique violation the
     * caller retries without the email — again, no orphan row (plan §1.5 /
     * M4 + A4).
     */
    async insertShopifyAccount(params: {
        shopifyUserId: string;
        shopDomain: string;
        email?: string;
    }): Promise<BusinessAccountSelect | null> {
        const [account] = await db
            .insert(businessAccountsTable)
            .values({
                shopifyUserId: params.shopifyUserId,
                shopifyShopDomain: params.shopDomain,
                email: params.email?.toLowerCase(),
            })
            .onConflictDoNothing({
                target: [
                    businessAccountsTable.shopifyUserId,
                    businessAccountsTable.shopifyShopDomain,
                ],
                where: sql`shopify_user_id IS NOT NULL AND shopify_shop_domain IS NOT NULL`,
            })
            .returning();
        return account ?? null;
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

    /**
     * Activate TOTP atomically: the `totp_activated_at IS NULL` predicate
     * makes the first caller win — a concurrent double-submit would otherwise
     * clobber the winner's `totp_recovery_codes_hash` with a second random
     * set while the user saves the first response's (now invalid) codes.
     * Returns whether this call performed the activation.
     */
    async activateTotp(params: {
        accountId: string;
        recoveryCodesHash: string[];
    }): Promise<boolean> {
        const rows = await db
            .update(businessAccountsTable)
            .set({
                totpActivatedAt: new Date(),
                totpRecoveryCodesHash: params.recoveryCodesHash,
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(businessAccountsTable.id, params.accountId),
                    isNull(businessAccountsTable.totpActivatedAt)
                )
            )
            .returning({ id: businessAccountsTable.id });
        return rows.length > 0;
    }

    /**
     * Single-use recovery code consumption, atomic (plan §1.7 / A3): one
     * conditional UPDATE removes the hash only if it's still present, and the
     * `RETURNING` row tells us whether THIS call was the one that consumed it.
     * Two concurrent redeems of the same code therefore can't both succeed —
     * the loser's `array_remove` is a no-op and returns no row.
     */
    async consumeTotpRecoveryCode(
        accountId: string,
        codeHash: string
    ): Promise<boolean> {
        const [row] = await db
            .update(businessAccountsTable)
            .set({
                totpRecoveryCodesHash: sql`array_remove(${businessAccountsTable.totpRecoveryCodesHash}, ${codeHash})`,
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(businessAccountsTable.id, accountId),
                    sql`${codeHash} = ANY(${businessAccountsTable.totpRecoveryCodesHash})`
                )
            )
            .returning({ id: businessAccountsTable.id });
        return row !== undefined;
    }

    /** Persist the windowed 2FA failed-attempt counter (plan §1.8). */
    async recordTwoFactorFailure(params: {
        accountId: string;
        attempts: number;
        windowStartedAt: Date | null;
    }): Promise<void> {
        await db
            .update(businessAccountsTable)
            .set({
                twoFactorAttempts: params.attempts,
                twoFactorWindowStartedAt: params.windowStartedAt,
                updatedAt: new Date(),
            })
            .where(eq(businessAccountsTable.id, params.accountId));
    }

    /** Clear the 2FA failed-attempt counter after a success (plan §1.8). */
    async resetTwoFactorAttempts(accountId: string): Promise<void> {
        await db
            .update(businessAccountsTable)
            .set({
                twoFactorAttempts: 0,
                twoFactorWindowStartedAt: null,
                updatedAt: new Date(),
            })
            .where(eq(businessAccountsTable.id, accountId));
    }
}
