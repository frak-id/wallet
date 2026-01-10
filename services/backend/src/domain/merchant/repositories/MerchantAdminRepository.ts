import { db } from "@backend-infrastructure";
import { and, eq } from "drizzle-orm";
import type { Address } from "viem";
import { merchantAdminsTable } from "../db/schema";

type MerchantAdminSelect = typeof merchantAdminsTable.$inferSelect;

export type { MerchantAdminSelect };

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

    async isAdmin(merchantId: string, wallet: Address): Promise<boolean> {
        const admin = await this.findByMerchantAndWallet(merchantId, wallet);
        return admin !== null;
    }

    async add(params: {
        merchantId: string;
        wallet: Address;
        addedBy: Address;
    }): Promise<MerchantAdminSelect> {
        const [result] = await db
            .insert(merchantAdminsTable)
            .values({
                merchantId: params.merchantId,
                wallet: params.wallet,
                addedBy: params.addedBy,
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

    async removeAllForMerchant(merchantId: string): Promise<number> {
        const result = await db
            .delete(merchantAdminsTable)
            .where(eq(merchantAdminsTable.merchantId, merchantId));
        return result.count;
    }
}
