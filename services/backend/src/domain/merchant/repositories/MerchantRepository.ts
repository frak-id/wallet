import { db } from "@backend-infrastructure";
import { arrayContains, eq, inArray, sql } from "drizzle-orm";
import { LRUCache } from "lru-cache";
import type { Address, Hex } from "viem";
import { merchantsTable } from "../db/schema";
import type { ExplorerConfig, SdkConfig } from "../schemas";

type MerchantInsert = typeof merchantsTable.$inferInsert;
type MerchantSelect = typeof merchantsTable.$inferSelect;

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

    private readonly defaultRewardTokenCache = new LRUCache<
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

    async getDefaultRewardToken(merchantId: string): Promise<Address | null> {
        const cached = this.defaultRewardTokenCache.get(merchantId);
        if (cached) {
            return cached.value;
        }

        const merchant = await this.findById(merchantId);
        const value = merchant?.defaultRewardToken ?? null;
        this.defaultRewardTokenCache.set(merchantId, { value });
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
        this.bankAddressCache.delete(merchant.id);
        this.defaultRewardTokenCache.delete(merchant.id);
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

    async update(
        id: string,
        fields: Partial<Pick<MerchantInsert, "name" | "defaultRewardToken">>
    ): Promise<MerchantSelect | null> {
        const updates = Object.fromEntries(
            Object.entries(fields).filter(([_, v]) => v !== undefined)
        );
        if (Object.keys(updates).length === 0) return this.findById(id);

        const [result] = await db
            .update(merchantsTable)
            .set({ ...updates, updatedAt: new Date() })
            .where(eq(merchantsTable.id, id))
            .returning();
        if (result) {
            this.invalidateCache(result);
        }
        return result ?? null;
    }

    async updateExplorer(
        id: string,
        { config, enabled }: { config?: ExplorerConfig; enabled?: boolean }
    ): Promise<MerchantSelect | null> {
        const [result] = await db
            .update(merchantsTable)
            .set({
                ...(config !== undefined && { explorerConfig: config }),
                ...(enabled !== undefined && {
                    explorerEnabledAt: enabled ? new Date() : null,
                }),
                updatedAt: new Date(),
            })
            .where(eq(merchantsTable.id, id))
            .returning();
        if (result) {
            this.invalidateCache(result);
        }
        return result ?? null;
    }

    async updateSdkConfig(
        id: string,
        config: SdkConfig
    ): Promise<MerchantSelect | null> {
        const [result] = await db
            .update(merchantsTable)
            .set({
                sdkConfig: config,
                updatedAt: new Date(),
            })
            .where(eq(merchantsTable.id, id))
            .returning();
        if (result) {
            this.invalidateCache(result);
        }
        return result ?? null;
    }

    async addAllowedDomain(
        id: string,
        domain: string
    ): Promise<MerchantSelect | null> {
        const [result] = await db
            .update(merchantsTable)
            .set({
                allowedDomains: sql`array_append(
                    array_remove(${merchantsTable.allowedDomains}, ${domain}),
                    ${domain}
                )`,
                updatedAt: new Date(),
            })
            .where(eq(merchantsTable.id, id))
            .returning();
        if (result) {
            this.invalidateCache(result);
        }
        return result ?? null;
    }

    async setAllowedDomains(
        id: string,
        domains: string[]
    ): Promise<MerchantSelect | null> {
        const [result] = await db
            .update(merchantsTable)
            .set({
                allowedDomains: domains,
                updatedAt: new Date(),
            })
            .where(eq(merchantsTable.id, id))
            .returning();
        if (result) {
            this.invalidateCache(result);
        }
        return result ?? null;
    }

    async findByAllowedDomain(domain: string): Promise<MerchantSelect | null> {
        const result = await db.query.merchantsTable.findFirst({
            where: arrayContains(merchantsTable.allowedDomains, [domain]),
        });
        return result ?? null;
    }
}
