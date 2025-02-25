import { log } from "@backend-common";
import type { KyInstance } from "ky";
import { LRUCache } from "lru-cache";
import type { Address, Chain, Client, Transport } from "viem";

/**
 * Repository to handle pending balance logic
 * This repository will check blockchain events to determine the pending balance
 * based on user actions, with caching to prevent excessive RPC calls
 */
export class PendingBalanceRepository {
    // Cache for pending balances to reduce RPC calls
    private readonly pendingBalanceCache = new LRUCache<string, number>({
        max: 1000,
        // Keep in cache for 5 minutes
        ttl: 300_000,
    });

    constructor(
        private readonly client: Client<Transport, Chain>,
        private readonly indexerApi: KyInstance
    ) {}

    /**
     * Get the pending balance for a wallet address
     * Pending balance is determined by user actions:
     * - 0.5$ upon wallet creation
     * - 1$ once the wallet is activated
     * - 2$ once the user has shared a referral link
     * @param address The wallet address
     * @returns The pending balance in USD
     */
    async getPendingBalance({
        address,
    }: { address: Address }): Promise<number> {
        // Check cache first
        const cacheKey = `pending-balance-${address}`;
        const cachedBalance = this.pendingBalanceCache.get(cacheKey);
        if (cachedBalance !== undefined) {
            return cachedBalance;
        }

        try {
            // Calculate pending balance based on user actions
            let pendingBalance = 0;

            // Check if wallet exists (always true if we're here, so add 0.5$)
            pendingBalance += 0.5;

            // Check if wallet is activated by looking for any transaction from this address
            const isActivated = await this.isWalletActivated(address);
            if (isActivated) {
                pendingBalance += 1;
            }

            // Check if user has shared a referral link
            const hasSharedReferral = await this.hasSharedReferral(address);
            if (hasSharedReferral) {
                pendingBalance += 2;
            }

            // Cache the result
            this.pendingBalanceCache.set(cacheKey, pendingBalance);
            return pendingBalance;
        } catch (error) {
            log.error("Error getting pending balance", { error, address });
            return 0;
        }
    }

    /**
     * Check if the wallet is activated (has made at least one transaction)
     * @param address The wallet address
     * @returns True if the wallet is activated
     */
    private async isWalletActivated(address: Address): Promise<boolean> {
        try {
            // Use indexer API to check if wallet has any transactions
            const response = await this.indexerApi
                .get(`transactions/count/${address}`)
                .json<{ count: number }>();
            return response.count > 0;
        } catch (error) {
            log.error("Error checking wallet activation", { error, address });
            return false;
        }
    }

    /**
     * Check if the user has shared a referral link
     * @param address The wallet address
     * @returns True if the user has shared a referral link
     */
    private async hasSharedReferral(address: Address): Promise<boolean> {
        try {
            // Use indexer API to check if user has any referrals
            const response = await this.indexerApi
                .get(`referrals/${address}`)
                .json<{ count: number }>();
            return response.count > 0;
        } catch (error) {
            log.error("Error checking referral sharing", { error, address });
            return false;
        }
    }
}
