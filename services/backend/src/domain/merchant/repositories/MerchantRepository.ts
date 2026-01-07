import { db } from "@backend-infrastructure";
import { eq } from "drizzle-orm";
import type { Address, Hex } from "viem";
import { type MerchantConfig, merchantsTable } from "../db/schema";

type MerchantInsert = typeof merchantsTable.$inferInsert;
type MerchantSelect = typeof merchantsTable.$inferSelect;

export class MerchantRepository {
    async findById(id: string): Promise<MerchantSelect | null> {
        const result = await db.query.merchantsTable.findFirst({
            where: eq(merchantsTable.id, id),
        });
        return result ?? null;
    }

    async findByDomain(domain: string): Promise<MerchantSelect | null> {
        const result = await db.query.merchantsTable.findFirst({
            where: eq(merchantsTable.domain, domain),
        });
        return result ?? null;
    }

    async findByProductId(productId: Hex): Promise<MerchantSelect | null> {
        const result = await db.query.merchantsTable.findFirst({
            where: eq(merchantsTable.productId, productId),
        });
        return result ?? null;
    }

    async create(merchant: MerchantInsert): Promise<MerchantSelect> {
        const [result] = await db
            .insert(merchantsTable)
            .values(merchant)
            .returning();
        if (!result) {
            throw new Error("Failed to create merchant");
        }
        return result;
    }

    async updateConfig(
        id: string,
        config: MerchantConfig
    ): Promise<MerchantSelect | null> {
        const [result] = await db
            .update(merchantsTable)
            .set({ config, updatedAt: new Date() })
            .where(eq(merchantsTable.id, id))
            .returning();
        return result ?? null;
    }

    async updateBankAddress(
        id: string,
        bankAddress: Address
    ): Promise<MerchantSelect | null> {
        const [result] = await db
            .update(merchantsTable)
            .set({ bankAddress, updatedAt: new Date() })
            .where(eq(merchantsTable.id, id))
            .returning();
        return result ?? null;
    }

    async upsertByProductId(
        merchant: MerchantInsert & { productId: Hex }
    ): Promise<MerchantSelect> {
        const [result] = await db
            .insert(merchantsTable)
            .values(merchant)
            .onConflictDoUpdate({
                target: merchantsTable.productId,
                set: {
                    name: merchant.name,
                    domain: merchant.domain,
                    bankAddress: merchant.bankAddress,
                    config: merchant.config,
                    updatedAt: new Date(),
                },
            })
            .returning();
        if (!result) {
            throw new Error("Failed to upsert merchant");
        }
        return result;
    }
}
