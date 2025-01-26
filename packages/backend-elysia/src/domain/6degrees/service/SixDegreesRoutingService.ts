import { eq } from "drizzle-orm";
import type { Hex } from "viem";
import type { SixDegreesDb } from "../context";
import { fixedRoutingTable, walletRoutingTable } from "../db/schema";

/**
 * Class helping us with 6degrees routing
 */
export class SixDegreesRoutingService {
    constructor(private readonly db: SixDegreesDb) {}

    /**
     * Check if a domain is routed for 6degrees
     */
    async isRoutedDomain(domain: string) {
        const existing = await this.db
            .select()
            .from(fixedRoutingTable)
            .where(eq(fixedRoutingTable.domain, domain));
        return existing.length > 0;
    }

    /**
     * Check if a wallet is routed for 6degrees
     */
    async isRoutedWallet(pubKey: Hex) {
        const existing = await this.db
            .select()
            .from(walletRoutingTable)
            .where(eq(walletRoutingTable.walletPubKey, pubKey));
        return existing.length > 0;
    }

    /**
     * Register a new routed wallet
     */
    async registerRoutedWallet(pubKey: Hex) {
        try {
            await this.db.insert(walletRoutingTable).values({
                walletPubKey: pubKey,
            });
        } catch (e) {
            console.warn("Unable to register the wallet routing", e);
        }
    }
}
