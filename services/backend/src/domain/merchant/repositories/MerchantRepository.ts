import { db } from "@backend-infrastructure";
import { eq, inArray } from "drizzle-orm";
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

    private readonly bankAddressCache = new LRUCache<
        string,
        { value: Address | null }
    >({
        max: 512,
        ttl: 5 * 60 * 1000,
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

    async findByIds(ids: string[]): Promise<MerchantSelect[]> {
        if (ids.length === 0) return [];

        const uncachedIds: string[] = [];
        const cachedResults: MerchantSelect[] = [];

        for (const id of ids) {
            const cached = this.idCache.get(id);
            if (cached?.value) {
                cachedResults.push(cached.value);
            } else if (!cached) {
                uncachedIds.push(id);
            }
        }

        if (uncachedIds.length === 0) {
            return cachedResults;
        }

        const dbResults = await db
            .select()
            .from(merchantsTable)
            .where(inArray(merchantsTable.id, uncachedIds));

        for (const merchant of dbResults) {
            this.idCache.set(merchant.id, { value: merchant });
        }

        const fetchedIds = new Set(dbResults.map((m) => m.id));
        for (const id of uncachedIds) {
            if (!fetchedIds.has(id)) {
                this.idCache.set(id, { value: null });
            }
        }

        return [...cachedResults, ...dbResults];
    }

    async getBankAddresses(
        merchantIds: string[]
    ): Promise<Map<string, Address>> {
        if (merchantIds.length === 0) return new Map();

        const result = new Map<string, Address>();
        const uncachedIds: string[] = [];

        for (const id of merchantIds) {
            const cached = this.bankAddressCache.get(id);
            if (cached) {
                if (cached.value) {
                    result.set(id, cached.value);
                }
            } else {
                uncachedIds.push(id);
            }
        }

        if (uncachedIds.length === 0) {
            return result;
        }

        const merchants = await this.findByIds(uncachedIds);

        for (const merchant of merchants) {
            this.bankAddressCache.set(merchant.id, {
                value: merchant.bankAddress,
            });
            if (merchant.bankAddress) {
                result.set(merchant.id, merchant.bankAddress);
            }
        }

        const foundIds = new Set(merchants.map((m) => m.id));
        for (const id of uncachedIds) {
            if (!foundIds.has(id)) {
                this.bankAddressCache.set(id, { value: null });
            }
        }

        return result;
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
        this.bankAddressCache.delete(merchant.id);
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
