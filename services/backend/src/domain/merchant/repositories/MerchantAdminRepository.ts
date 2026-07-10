import { db } from "@backend-infrastructure";
import { and, eq, or, type SQL } from "drizzle-orm";
import type { Address } from "viem";
import { merchantAdminsTable } from "../db/schema";
import type { MerchantIdentity } from "../schemas";

type MerchantAdminSelect = typeof merchantAdminsTable.$inferSelect;

/**
 * Match an admin row by wallet OR account — either axis grants the role.
 * Returns null when the identity is empty (no wallet, no account).
 */
function identityFilter(identity: MerchantIdentity): SQL | null {
    const clauses: SQL[] = [];
    if (identity.wallet) {
        clauses.push(eq(merchantAdminsTable.wallet, identity.wallet));
    }
    if (identity.accountId) {
        clauses.push(eq(merchantAdminsTable.accountId, identity.accountId));
    }
    if (clauses.length === 0) return null;
    return (clauses.length === 1 ? clauses[0] : or(...clauses)) ?? null;
}

export class MerchantAdminRepository {
    async findByMerchantAndWallet(
        merchantId: string,
        wallet: Address
    ): Promise<MerchantAdminSelect | null> {
        const result = await db.query.merchantAdminsTable.findFirst({
            where: and(
                eq(merchantAdminsTable.merchantId, merchantId),
                eq(merchantAdminsTable.wallet, wallet)
            ),
        });
        return result ?? null;
    }

    async findByMerchantAndAccount(
        merchantId: string,
        accountId: string
    ): Promise<MerchantAdminSelect | null> {
        const result = await db.query.merchantAdminsTable.findFirst({
            where: and(
                eq(merchantAdminsTable.merchantId, merchantId),
                eq(merchantAdminsTable.accountId, accountId)
            ),
        });
        return result ?? null;
    }

    async findByMerchant(merchantId: string): Promise<MerchantAdminSelect[]> {
        return db.query.merchantAdminsTable.findMany({
            where: eq(merchantAdminsTable.merchantId, merchantId),
        });
    }

    async findByWallet(wallet: Address): Promise<MerchantAdminSelect[]> {
        return db.query.merchantAdminsTable.findMany({
            where: eq(merchantAdminsTable.wallet, wallet),
        });
    }

    async findByIdentity(
        identity: MerchantIdentity
    ): Promise<MerchantAdminSelect[]> {
        const filter = identityFilter(identity);
        if (!filter) return [];
        return db.query.merchantAdminsTable.findMany({ where: filter });
    }

    async isAdmin(
        merchantId: string,
        identity: MerchantIdentity
    ): Promise<boolean> {
        const filter = identityFilter(identity);
        if (!filter) return false;
        const admin = await db.query.merchantAdminsTable.findFirst({
            where: and(eq(merchantAdminsTable.merchantId, merchantId), filter),
        });
        return admin !== undefined;
    }

    /**
     * Add an admin by wallet OR by business account (§2.7), mirroring the
     * `MerchantIdentity` axes. Idempotent: `ON CONFLICT DO NOTHING` covers
     * both the `(merchantId, wallet)` unique and the partial
     * `(merchantId, accountId)` unique, and we resolve the existing row on
     * the axis that was supplied.
     */
    async add(params: {
        merchantId: string;
        identity: { wallet: Address } | { accountId: string };
        addedBy?: Address | null;
        addedByAccountId?: string | null;
    }): Promise<MerchantAdminSelect> {
        const wallet =
            "wallet" in params.identity ? params.identity.wallet : null;
        const accountId =
            "accountId" in params.identity ? params.identity.accountId : null;

        const [result] = await db
            .insert(merchantAdminsTable)
            .values({
                merchantId: params.merchantId,
                wallet,
                accountId,
                addedBy: params.addedBy ?? null,
                addedByAccountId: params.addedByAccountId ?? null,
            })
            .onConflictDoNothing()
            .returning();
        if (result) return result;

        const existing = wallet
            ? await this.findByMerchantAndWallet(params.merchantId, wallet)
            : await this.findByMerchantAndAccount(
                  params.merchantId,
                  accountId as string
              );
        if (!existing) {
            throw new Error("Failed to add admin");
        }
        return existing;
    }

    /**
     * Remove an admin by its row id (§2.7). Keyed on the row rather than the
     * wallet so account-only admins (wallet NULL) are removable too. Scoped
     * to `merchantId` so an id from another merchant can't be deleted.
     */
    async removeById(merchantId: string, adminId: string): Promise<boolean> {
        const result = await db
            .delete(merchantAdminsTable)
            .where(
                and(
                    eq(merchantAdminsTable.merchantId, merchantId),
                    eq(merchantAdminsTable.id, adminId)
                )
            );
        return result.count > 0;
    }
}
