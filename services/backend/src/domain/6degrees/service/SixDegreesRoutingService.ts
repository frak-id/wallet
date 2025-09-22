import { eq } from "drizzle-orm";
import { db } from "infrastructure/db";
import { LRUCache } from "lru-cache";
import type { Hex } from "viem";
import { fixedRoutingTable, walletRoutingTable } from "../db/schema";

/**
 * Class helping us with 6degrees routing
 */
export class SixDegreesRoutingService {
    private readonly domainRoutingCache = new LRUCache<string, boolean>({
        max: 1000,
        // TTL of 5 minutes
        ttl: 60_000 * 5,
    });
    private readonly walletRoutingCache = new LRUCache<Hex, boolean>({
        max: 1000,
        // TTL of 5 minutes
        ttl: 60_000 * 5,
    });

    /**
     * Check if a domain is routed for 6degrees
     */
    async isRoutedDomain(domain: string): Promise<boolean> {
        const cached = this.domainRoutingCache.get(domain);
        if (cached) {
            return cached;
        }
        const existing = await db
            .select()
            .from(fixedRoutingTable)
            .where(eq(fixedRoutingTable.domain, domain));

        const isRouted = existing.length > 0;
        this.domainRoutingCache.set(domain, isRouted);
        return isRouted;
    }

    /**
     * Check if a wallet is routed for 6degrees
     */
    async isRoutedWallet(pubKey: Hex) {
        const cached = this.walletRoutingCache.get(pubKey);
        if (cached) {
            return cached;
        }

        const existing = await db
            .select()
            .from(walletRoutingTable)
            .where(eq(walletRoutingTable.walletPubKey, pubKey));

        const isRouted = existing.length > 0;
        this.walletRoutingCache.set(pubKey, isRouted);
        return isRouted;
    }

    /**
     * Register a new routed wallet
     */
    async registerRoutedWallet(pubKey: Hex) {
        try {
            await db.insert(walletRoutingTable).values({
                walletPubKey: pubKey,
            });
            // Then invalidate the cache for this key if any
            this.walletRoutingCache.delete(pubKey);
        } catch (e) {
            console.warn("Unable to register the wallet routing", e);
        }
    }
}
