import { log } from "@backend-common";
import type { PricingRepository } from "@backend-common/repositories";
import type { TokenAmount } from "@backend-utils";
import {
    type GetInteractionsResponseDto,
    type GetRewardHistoryResponseDto,
    usdcArbitrumAddress,
} from "@frak-labs/app-essentials";
import type { KyInstance } from "ky";
import { LRUCache } from "lru-cache";
import type { Address, Chain, Client, Transport } from "viem";
import { getCode } from "viem/actions";

/**
 * Repository to handle pending balance logic
 * This repository will check blockchain events to determine the pending balance
 * based on user actions, with caching to prevent excessive RPC calls
 */
export class PendingBalanceRepository {
    // Cache for pending balances to reduce RPC calls
    private readonly pendingBalanceCache = new LRUCache<Address, number>({
        max: 1000,
        // Keep in cache for 5 minutes
        ttl: 300_000,
    });

    constructor(
        private readonly client: Client<Transport, Chain>,
        private readonly indexerApi: KyInstance,
        private readonly pricingRepository: PricingRepository
    ) {}

    async getPendingBalance({
        address,
    }: { address: Address }): Promise<TokenAmount> {
        const pendingBalance = await this._getPendingBalance({ address });

        const price = await this.pricingRepository.getTokenPrice({
            token: usdcArbitrumAddress,
        });

        return {
            amount: pendingBalance,
            eurAmount: price ? pendingBalance * price.eur : 0,
            usdAmount: price ? pendingBalance * price.usd : 0,
            gbpAmount: price ? pendingBalance * price.gbp : 0,
        };
    }

    /**
     * Get the pending balance for a wallet address
     * Pending balance is determined by user actions:
     * - 0.5$ upon wallet creation
     * - 0.5$ once the wallet is activated
     * - 1$ once the user has shared a referral link
     * @param address The wallet address
     * @returns The pending balance in USD
     */
    private async _getPendingBalance({
        address,
    }: { address: Address }): Promise<number> {
        // Check cache first
        const cachedBalance = this.pendingBalanceCache.get(address);
        if (cachedBalance !== undefined) {
            return cachedBalance;
        }

        try {
            // Check if the user has earned a reward
            const hasEarnedReward = await this.hasEarnedReward(address);
            if (hasEarnedReward) {
                return 0;
            }

            // Calculate pending balance based on user actions
            let pendingBalance = 0;

            // Check if wallet exists (always true if we're here, so add 0.5$)
            pendingBalance += 0.5;

            // Check if wallet is activated by checking if the smart contract is deployed
            const isActivated = await this.isWalletActivated(address);
            if (isActivated) {
                pendingBalance += 0.5;
            }

            // Check if user has shared a referral link
            const hasSharedReferral = await this.hasSharedReferral(address);
            if (hasSharedReferral) {
                pendingBalance += 1;
            }

            // Cache the result
            this.pendingBalanceCache.set(address, pendingBalance);
            return pendingBalance;
        } catch (error) {
            log.error("Error getting pending balance", { error, address });
            return 0;
        }
    }

    /**
     * Check if the wallet is activated by verifying if the smart contract has been deployed
     * For Smart Accounts, the wallet is a smart contract, so if it has code, it's been activated
     * @param address The wallet address
     * @returns True if the wallet is activated (contract deployed)
     */
    private async isWalletActivated(address: Address): Promise<boolean> {
        try {
            // Get the code at the wallet address
            const code = await getCode(this.client, { address });

            // If there's code (not '0x' which means no code), the wallet is activated
            return code !== "0x";
        } catch (error) {
            log.error("Error checking wallet activation", { error, address });
            return false;
        }
    }

    /**
     * Check if the user has shared a referral link
     * This method checks if the user has any referral-related interactions
     * @param address The wallet address
     * @returns True if the user has shared a referral link
     */
    private async hasSharedReferral(address: Address): Promise<boolean> {
        try {
            // Get all interactions for this address
            const interactions = await this.indexerApi
                .get(`interactions/${address}`)
                .json<GetInteractionsResponseDto>();

            // Check if there are any CREATE_REFERRAL_LINK or REFERRED interactions
            return interactions.some(
                (interaction) =>
                    interaction.type === "CREATE_REFERRAL_LINK" ||
                    interaction.type === "REFERRED"
            );
        } catch (error) {
            log.error("Error checking referral sharing", { error, address });
            return false;
        }
    }

    /**
     * Check if the user has earned a reward
     * This method checks if the user has any reward-related interactions
     * @param address The wallet address
     * @returns True if the user has earned a reward
     */
    private async hasEarnedReward(address: Address): Promise<boolean> {
        try {
            // Get the reward history for the user
            const rewards = await this.indexerApi
                .get(`rewards/${address}/history`)
                .json<GetRewardHistoryResponseDto>();

            // Check if the user has earned a reward
            return rewards.added.length > 0;
        } catch (error) {
            log.error("Error checking reward earning", { error, address });
            return false;
        }
    }
}
