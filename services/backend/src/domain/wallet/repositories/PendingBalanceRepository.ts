import { indexerApi, log, viemClient } from "@backend-common";
import type { TokenAmount } from "@backend-utils";
import type { GetRewardHistoryResponseDto } from "@frak-labs/app-essentials";
import type { Address } from "viem";
import { getCode } from "viem/actions";

/**
 * Repository to handle pending balance logic
 * This repository will check blockchain events to determine the pending balance
 * based on user actions, with caching to prevent excessive RPC calls
 */
export class PendingBalanceRepository {
    async getPendingBalance({
        address,
    }: { address: Address }): Promise<TokenAmount> {
        const pendingBalance = await this._getPendingBalance({ address });

        return {
            amount: pendingBalance,
            eurAmount: pendingBalance,
            usdAmount: pendingBalance,
            gbpAmount: pendingBalance,
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
        try {
            // Check if the user has earned a reward
            const hasEarnedReward = await this.hasEarnedReward(address);
            if (hasEarnedReward) {
                return 0;
            }

            // Calculate pending balance based on user actions (default to 0.5$ for new users)
            let pendingBalance = 0.5;

            // Check if wallet is activated and if the user has shared a referral link
            const isActivated = await this.isWalletActivated(address);

            if (isActivated) {
                pendingBalance += 0.5;
            }

            // Cache the result
            return pendingBalance;
        } catch (error) {
            log.error(
                { error, address },
                "[PendingBalanceRepository] Error getting pending balance"
            );
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
            const code = await getCode(viemClient, { address });

            // If there's code (not '0x' which means no code), the wallet is activated
            return code !== undefined && code !== "0x";
        } catch (error) {
            log.error(
                { error, address },
                "[PendingBalanceRepository] Error checking wallet activation"
            );
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
            const rewards = await indexerApi
                .get(`rewards/${address}/history`)
                .json<GetRewardHistoryResponseDto>();

            // Check if the user has earned a reward
            return rewards.added.length > 0;
        } catch (error) {
            log.error(
                { error, address },
                "[PendingBalanceRepository] Error checking reward earning"
            );
            return false;
        }
    }
}
