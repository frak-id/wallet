import { log } from "@backend-infrastructure";
import type { Address, Hex } from "viem";
import { parseUnits } from "viem";
import {
    type RewardsHubRepository,
    rewardsHubRepository,
} from "../../../infrastructure/blockchain/contracts/RewardsHubRepository";
import { MerchantRepository } from "../../merchant/repositories/MerchantRepository";
import type { AssetLogSelect } from "../db/schema";
import { AssetLogRepository } from "../repositories/AssetLogRepository";
import {
    type SettlementResult,
    buildAttestation,
    encodeUserId,
} from "../types";

const DEFAULT_TOKEN_DECIMALS = 18;
const SETTLEMENT_BATCH_SIZE = 100;

type AssetLogWithWallet = AssetLogSelect & { walletAddress: Address | null };

type BatchResult = {
    successCount: number;
    failedCount: number;
    txHashes: Hex[];
    errors: Array<{ assetLogId: string; error: string }>;
};

type PreparedPushData = {
    assetLogId: string;
    wallet: Address;
    amount: bigint;
    token: Address;
    bank: Address;
    attestation: Hex;
};

type PreparedLockData = {
    assetLogId: string;
    userId: Hex;
    amount: bigint;
    token: Address;
    bank: Address;
    attestation: Hex;
};

export class SettlementService {
    private readonly assetLogRepository: AssetLogRepository;
    private readonly merchantRepository: MerchantRepository;
    private readonly rewardsHub: RewardsHubRepository;

    constructor(
        assetLogRepository?: AssetLogRepository,
        merchantRepository?: MerchantRepository,
        rewardsHub?: RewardsHubRepository
    ) {
        this.assetLogRepository =
            assetLogRepository ?? new AssetLogRepository();
        this.merchantRepository =
            merchantRepository ?? new MerchantRepository();
        this.rewardsHub = rewardsHub ?? rewardsHubRepository;
    }

    async settleRewards(): Promise<SettlementResult> {
        const result: SettlementResult = {
            pushedCount: 0,
            lockedCount: 0,
            failedCount: 0,
            txHashes: [],
            errors: [],
        };

        const pendingRewards =
            await this.assetLogRepository.findPendingForSettlement(
                SETTLEMENT_BATCH_SIZE
            );

        if (pendingRewards.length === 0) {
            log.debug("No pending rewards to settle");
            return result;
        }

        const { withWallet, withoutWallet } =
            this.partitionByWalletPresence(pendingRewards);

        if (withWallet.length > 0) {
            const pushResult = await this.pushRewardsToWallets(withWallet);
            this.mergeResults(result, pushResult, "pushed");
        }

        if (withoutWallet.length > 0) {
            const lockResult =
                await this.lockRewardsForAnonymous(withoutWallet);
            this.mergeResults(result, lockResult, "locked");
        }

        log.info(
            {
                pushed: result.pushedCount,
                locked: result.lockedCount,
                failed: result.failedCount,
                txCount: result.txHashes.length,
            },
            "Settlement batch completed"
        );

        return result;
    }

    private partitionByWalletPresence(rewards: AssetLogWithWallet[]): {
        withWallet: AssetLogWithWallet[];
        withoutWallet: AssetLogWithWallet[];
    } {
        const withWallet: AssetLogWithWallet[] = [];
        const withoutWallet: AssetLogWithWallet[] = [];

        for (const reward of rewards) {
            if (reward.walletAddress) {
                withWallet.push(reward);
            } else {
                withoutWallet.push(reward);
            }
        }

        return { withWallet, withoutWallet };
    }

    private mergeResults(
        target: SettlementResult,
        source: BatchResult,
        type: "pushed" | "locked"
    ): void {
        if (type === "pushed") {
            target.pushedCount = source.successCount;
        } else {
            target.lockedCount = source.successCount;
        }
        target.failedCount += source.failedCount;
        target.txHashes.push(...source.txHashes);
        target.errors.push(...source.errors);
    }

    private async getMerchantBanks(
        rewards: AssetLogWithWallet[]
    ): Promise<Map<string, Address>> {
        const merchantBanks = new Map<string, Address>();

        for (const reward of rewards) {
            if (merchantBanks.has(reward.merchantId)) continue;

            const merchant = await this.merchantRepository.findById(
                reward.merchantId
            );
            if (merchant?.bankAddress) {
                merchantBanks.set(reward.merchantId, merchant.bankAddress);
            }
        }

        return merchantBanks;
    }

    private async pushRewardsToWallets(
        rewards: AssetLogWithWallet[]
    ): Promise<BatchResult> {
        const result = this.createEmptyBatchResult();
        const merchantBanks = await this.getMerchantBanks(rewards);
        const pushData = this.preparePushData(rewards, merchantBanks, result);

        if (pushData.length === 0) return result;

        return this.executePushTransaction(pushData, result);
    }

    private preparePushData(
        rewards: AssetLogWithWallet[],
        merchantBanks: Map<string, Address>,
        result: BatchResult
    ): PreparedPushData[] {
        const pushData: PreparedPushData[] = [];

        for (const reward of rewards) {
            const validationError = this.validateRewardForPush(
                reward,
                merchantBanks
            );
            if (validationError) {
                result.errors.push({
                    assetLogId: reward.id,
                    error: validationError,
                });
                result.failedCount++;
                continue;
            }

            pushData.push({
                assetLogId: reward.id,
                wallet: reward.walletAddress as Address,
                amount: parseUnits(reward.amount, DEFAULT_TOKEN_DECIMALS),
                token: reward.tokenAddress as Address,
                bank: merchantBanks.get(reward.merchantId) as Address,
                attestation: this.buildAttestationHex(reward),
            });
        }

        return pushData;
    }

    private validateRewardForPush(
        reward: AssetLogWithWallet,
        merchantBanks: Map<string, Address>
    ): string | null {
        if (!merchantBanks.has(reward.merchantId)) {
            return "Merchant bank not found";
        }
        if (!reward.tokenAddress) {
            return "Token address not set";
        }
        if (!reward.walletAddress) {
            return "Wallet address not set";
        }
        return null;
    }

    private async executePushTransaction(
        pushData: PreparedPushData[],
        result: BatchResult
    ): Promise<BatchResult> {
        try {
            const txResult = await this.rewardsHub.pushRewards(
                pushData.map((d) => ({
                    wallet: d.wallet,
                    amount: d.amount,
                    token: d.token,
                    bank: d.bank,
                    attestation: d.attestation,
                }))
            );

            result.txHashes.push(txResult.txHash);
            await this.assetLogRepository.updateStatusBatch(
                pushData.map((d) => d.assetLogId),
                "ready_to_claim",
                { txHash: txResult.txHash, blockNumber: txResult.blockNumber }
            );
            result.successCount = pushData.length;
        } catch (error) {
            this.handleBatchError(error, pushData, result, "push rewards");
        }

        return result;
    }

    private async lockRewardsForAnonymous(
        rewards: AssetLogWithWallet[]
    ): Promise<BatchResult> {
        const result = this.createEmptyBatchResult();
        const merchantBanks = await this.getMerchantBanks(rewards);
        const lockData = this.prepareLockData(rewards, merchantBanks, result);

        if (lockData.length === 0) return result;

        return this.executeLockTransaction(lockData, result);
    }

    private prepareLockData(
        rewards: AssetLogWithWallet[],
        merchantBanks: Map<string, Address>,
        result: BatchResult
    ): PreparedLockData[] {
        const lockData: PreparedLockData[] = [];

        for (const reward of rewards) {
            const validationError = this.validateRewardForLock(
                reward,
                merchantBanks
            );
            if (validationError) {
                result.errors.push({
                    assetLogId: reward.id,
                    error: validationError,
                });
                result.failedCount++;
                continue;
            }

            lockData.push({
                assetLogId: reward.id,
                userId: encodeUserId(reward.identityGroupId),
                amount: parseUnits(reward.amount, DEFAULT_TOKEN_DECIMALS),
                token: reward.tokenAddress as Address,
                bank: merchantBanks.get(reward.merchantId) as Address,
                attestation: this.buildAttestationHex(reward),
            });
        }

        return lockData;
    }

    private validateRewardForLock(
        reward: AssetLogWithWallet,
        merchantBanks: Map<string, Address>
    ): string | null {
        if (!merchantBanks.has(reward.merchantId)) {
            return "Merchant bank not found";
        }
        if (!reward.tokenAddress) {
            return "Token address not set";
        }
        return null;
    }

    private async executeLockTransaction(
        lockData: PreparedLockData[],
        result: BatchResult
    ): Promise<BatchResult> {
        try {
            const txResult = await this.rewardsHub.lockRewards(
                lockData.map((d) => ({
                    userId: d.userId,
                    amount: d.amount,
                    token: d.token,
                    bank: d.bank,
                    attestation: d.attestation,
                }))
            );

            result.txHashes.push(txResult.txHash);
            await this.assetLogRepository.updateStatusBatch(
                lockData.map((d) => d.assetLogId),
                "ready_to_claim",
                { txHash: txResult.txHash, blockNumber: txResult.blockNumber }
            );
            result.successCount = lockData.length;
        } catch (error) {
            this.handleBatchError(error, lockData, result, "lock rewards");
        }

        return result;
    }

    private createEmptyBatchResult(): BatchResult {
        return {
            successCount: 0,
            failedCount: 0,
            txHashes: [],
            errors: [],
        };
    }

    private handleBatchError(
        error: unknown,
        data: Array<{ assetLogId: string }>,
        result: BatchResult,
        operation: string
    ): void {
        log.error(
            { error, count: data.length },
            `Failed to ${operation} batch`
        );
        const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
        for (const item of data) {
            result.errors.push({
                assetLogId: item.assetLogId,
                error: errorMessage,
            });
        }
        result.failedCount += data.length;
    }

    private buildAttestationHex(reward: AssetLogSelect): Hex {
        const events = [
            { event: "reward_created", timestamp: reward.createdAt },
        ];

        if (reward.purchaseId) {
            events.unshift({ event: "purchase", timestamp: reward.createdAt });
        }

        const base64 = buildAttestation(events);
        return `0x${Buffer.from(base64).toString("hex")}` as Hex;
    }
}
