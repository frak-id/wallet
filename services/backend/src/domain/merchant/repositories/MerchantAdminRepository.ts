import { db } from "@backend-infrastructure";
import { and, eq, or, type SQL } from "drizzle-orm";
import type { Address } from "viem";
import { merchantAdminsTable } from "../db/schema";
import type { MerchantIdentity } from "../services/MerchantAuthorizationService";

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

    async add(params: {
        merchantId: string;
        wallet: Address;
        addedBy?: Address | null;
        addedByAccountId?: string | null;
    }): Promise<MerchantAdminSelect> {
        const [result] = await db
            .insert(merchantAdminsTable)
            .values({
                merchantId: params.merchantId,
                wallet: params.wallet,
                addedBy: params.addedBy ?? null,
                addedByAccountId: params.addedByAccountId ?? null,
            })
            .onConflictDoNothing()
            .returning();

        if (!result) {
            const existing = await this.findByMerchantAndWallet(
                params.merchantId,
                params.wallet
            );
            if (!existing) {
                throw new Error("Failed to add admin");
            }
            return existing;
        }
        return result;
    }

    async remove(merchantId: string, wallet: Address): Promise<boolean> {
        const result = await db
            .delete(merchantAdminsTable)
            .where(
                and(
                    eq(merchantAdminsTable.merchantId, merchantId),
                    eq(merchantAdminsTable.wallet, wallet)
                )
            );
        return result.count > 0;
    }
}
