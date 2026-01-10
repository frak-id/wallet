import { db } from "@backend-infrastructure";
import { eq } from "drizzle-orm";
import { LRUCache } from "lru-cache";
import type { Address, Hex } from "viem";
import { type MerchantConfig, merchantsTable } from "../db/schema";

type MerchantInsert = typeof merchantsTable.$inferInsert;
type MerchantSelect = typeof merchantsTable.$inferSelect;

export type { MerchantSelect };

export class MerchantRepository {
    private readonly domainCache = new LRUCache<
        string,
        { value: MerchantSelect | null }
    >({
        max: 256,
        ttl: 60 * 60 * 1000,
    });

    private readonly productIdCache = new LRUCache<
        string,
        { value: MerchantSelect | null }
    >({
        max: 256,
        ttl: 60 * 60 * 1000,
    });

    private readonly idCache = new LRUCache<
        string,
        { value: MerchantSelect | null }
    >({
        max: 256,
        ttl: 60 * 60 * 1000,
    });
    async findById(id: string): Promise<MerchantSelect | null> {
        const cached = this.idCache.get(id);
        if (cached) {
            return cached.value;
        }

        const result = await db.query.merchantsTable.findFirst({
            where: eq(merchantsTable.id, id),
        });
        const value = result ?? null;
        this.idCache.set(id, { value });
        return value;
    }

    async findByDomain(domain: string): Promise<MerchantSelect | null> {
        const cached = this.domainCache.get(domain);
        if (cached) {
            return cached.value;
        }

        const result = await db.query.merchantsTable.findFirst({
            where: eq(merchantsTable.domain, domain),
        });
        const value = result ?? null;
        this.domainCache.set(domain, { value });
        return value;
    }

    async findByProductId(productId: Hex): Promise<MerchantSelect | null> {
        const cached = this.productIdCache.get(productId);
        if (cached) {
            return cached.value;
        }

        const result = await db.query.merchantsTable.findFirst({
            where: eq(merchantsTable.productId, productId),
        });
        const value = result ?? null;
        this.productIdCache.set(productId, { value });
        return value;
    }

    async findByOwnerWallet(wallet: Address): Promise<MerchantSelect[]> {
        return db.query.merchantsTable.findMany({
            where: eq(merchantsTable.ownerWallet, wallet),
        });
    }

    private invalidateCache(merchant: MerchantSelect): void {
        this.idCache.delete(merchant.id);
        this.domainCache.delete(merchant.domain);
        if (merchant.productId) {
            this.productIdCache.delete(merchant.productId);
        }
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
        if (result) {
            this.invalidateCache(result);
        }
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
        if (result) {
            this.invalidateCache(result);
        }
        return result ?? null;
    }

    async updateOwner(
        id: string,
        ownerWallet: Address
    ): Promise<MerchantSelect | null> {
        const [result] = await db
            .update(merchantsTable)
            .set({ ownerWallet, updatedAt: new Date() })
            .where(eq(merchantsTable.id, id))
            .returning();
        if (result) {
            this.invalidateCache(result);
        }
        return result ?? null;
    }

    async updateVerifiedAt(id: string): Promise<MerchantSelect | null> {
        const [result] = await db
            .update(merchantsTable)
            .set({ verifiedAt: new Date(), updatedAt: new Date() })
            .where(eq(merchantsTable.id, id))
            .returning();
        if (result) {
            this.invalidateCache(result);
        }
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
        this.invalidateCache(result);
        return result;
    }
}
