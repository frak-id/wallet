import { log, viemClient } from "@backend-infrastructure";
import { isRunningInProd, rewarderHubAbi } from "@frak-labs/app-essentials";
import { type Address, encodeFunctionData, type Hex, pad } from "viem";
import { sendTransaction, waitForTransactionReceipt } from "viem/actions";
import { adminWalletsRepository } from "../../keys/AdminWalletsRepository";

const REWARDER_KEY = "rewarder" as const;

const REWARDS_HUB_ADDRESS: Address = isRunningInProd
    ? "0x0000000000000000000000000000000000000000"
    : "0x0000000000000000000000000000000000000000";

type RewardOp = {
    isLock: boolean;
    target: Hex;
    amount: bigint;
    token: Address;
    bank: Address;
    attestation: Hex;
};

type ResolveOp = {
    userId: Hex;
    wallet: Address;
};

type PushRewardParams = {
    wallet: Address;
    amount: bigint;
    token: Address;
    bank: Address;
    attestation: Hex;
};

type LockRewardParams = {
    userId: Hex;
    amount: bigint;
    token: Address;
    bank: Address;
    attestation: Hex;
};

function addressToBytes32(address: Address): Hex {
    return pad(address, { size: 32 });
}

function sortOpsByBankAndToken(ops: RewardOp[]): RewardOp[] {
    return [...ops].sort((a, b) => {
        const bankCompare = a.bank
            .toLowerCase()
            .localeCompare(b.bank.toLowerCase());
        if (bankCompare !== 0) return bankCompare;
        return a.token.toLowerCase().localeCompare(b.token.toLowerCase());
    });
}

export class RewardsHubRepository {
    private readonly contractAddress: Address;

    constructor(contractAddress?: Address) {
        this.contractAddress = contractAddress ?? REWARDS_HUB_ADDRESS;
    }

    async pushRewards(rewards: PushRewardParams[]): Promise<{
        txHash: Hex;
        blockNumber: bigint;
    }> {
        if (rewards.length === 0) {
            throw new Error("No rewards to push");
        }

        const ops: RewardOp[] = rewards.map((r) => ({
            isLock: false,
            target: addressToBytes32(r.wallet),
            amount: r.amount,
            token: r.token,
            bank: r.bank,
            attestation: r.attestation,
        }));

        return this.executeBatch(ops);
    }

    async lockRewards(locks: LockRewardParams[]): Promise<{
        txHash: Hex;
        blockNumber: bigint;
    }> {
        if (locks.length === 0) {
            throw new Error("No locks to process");
        }

        const ops: RewardOp[] = locks.map((l) => ({
            isLock: true,
            target: l.userId,
            amount: l.amount,
            token: l.token,
            bank: l.bank,
            attestation: l.attestation,
        }));

        return this.executeBatch(ops);
    }

    async batchRewards(
        pushRewards: PushRewardParams[],
        lockRewards: LockRewardParams[]
    ): Promise<{
        txHash: Hex;
        blockNumber: bigint;
    }> {
        if (pushRewards.length === 0 && lockRewards.length === 0) {
            throw new Error("No rewards to process");
        }

        const ops: RewardOp[] = [
            ...pushRewards.map((r) => ({
                isLock: false as const,
                target: addressToBytes32(r.wallet),
                amount: r.amount,
                token: r.token,
                bank: r.bank,
                attestation: r.attestation,
            })),
            ...lockRewards.map((l) => ({
                isLock: true as const,
                target: l.userId,
                amount: l.amount,
                token: l.token,
                bank: l.bank,
                attestation: l.attestation,
            })),
        ];

        return this.executeBatch(ops);
    }

    async resolveUserIds(resolves: ResolveOp[]): Promise<{
        txHash: Hex;
        blockNumber: bigint;
    }> {
        if (resolves.length === 0) {
            throw new Error("No userIds to resolve");
        }

        return this.executeTransaction("resolveUserIds", [resolves]);
    }

    private async executeBatch(ops: RewardOp[]): Promise<{
        txHash: Hex;
        blockNumber: bigint;
    }> {
        const sortedOps = sortOpsByBankAndToken(ops);
        return this.executeTransaction("batch", [sortedOps]);
    }

    private async executeTransaction(
        functionName: "batch" | "resolveUserIds",
        args: unknown[]
    ): Promise<{
        txHash: Hex;
        blockNumber: bigint;
    }> {
        const mutex = adminWalletsRepository.getMutexForAccount({
            key: REWARDER_KEY,
        });

        return mutex.runExclusive(async () => {
            const account = await adminWalletsRepository.getKeySpecificAccount({
                key: REWARDER_KEY,
            });

            const data = encodeFunctionData({
                abi: rewarderHubAbi,
                functionName,
                args: args as never,
            });

            log.debug(
                {
                    functionName,
                    contractAddress: this.contractAddress,
                    account: account.address,
                    opsCount: Array.isArray(args[0]) ? args[0].length : 1,
                },
                "Executing RewardsHub transaction"
            );

            const txHash = await sendTransaction(viemClient, {
                account,
                to: this.contractAddress,
                data,
            });

            const receipt = await waitForTransactionReceipt(viemClient, {
                hash: txHash,
            });

            log.info(
                {
                    functionName,
                    txHash,
                    blockNumber: receipt.blockNumber,
                    gasUsed: receipt.gasUsed,
                },
                "RewardsHub transaction confirmed"
            );

            return {
                txHash,
                blockNumber: receipt.blockNumber,
            };
        });
    }
}

export type { PushRewardParams, LockRewardParams, ResolveOp };
export const rewardsHubRepository = new RewardsHubRepository();
