import { log, viemClient } from "@backend-infrastructure";
import { addresses, rewarderHubAbi } from "@frak-labs/app-essentials";
import { type Address, encodeFunctionData, type Hex, pad } from "viem";
import { sendTransaction, waitForTransactionReceipt } from "viem/actions";
import { adminWalletsRepository } from "../../keys/AdminWalletsRepository";

type RewardOp = {
    isLock: boolean;
    target: Hex;
    amount: bigint;
    token: Address;
    bank: Address;
    attestation: Hex;
};

type PushRewardParams = {
    wallet: Address;
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

    private async executeBatch(ops: RewardOp[]): Promise<{
        txHash: Hex;
        blockNumber: bigint;
    }> {
        const sortedOps = sortOpsByBankAndToken(ops);
        return this.executeTransaction(sortedOps);
    }

    private async executeTransaction(args: RewardOp[]): Promise<{
        txHash: Hex;
        blockNumber: bigint;
    }> {
        const mutex = adminWalletsRepository.getMutexForAccount({
            key: "rewarder",
        });

        return mutex.runExclusive(async () => {
            const account = await adminWalletsRepository.getKeySpecificAccount({
                key: "rewarder",
            });

            const data = encodeFunctionData({
                abi: rewarderHubAbi,
                functionName: "batch",
                args: [
                    args.map(
                        (op) =>
                            ({
                                wallet: op.target,
                                amount: op.amount,
                                token: op.token,
                                bank: op.bank,
                                attestation: op.attestation,
                            }) as const
                    ),
                ],
            });

            log.debug(
                {
                    functionName: "batch",
                    contractAddress: addresses.rewarderHub,
                    account: account.address,
                    opsCount: Array.isArray(args[0]) ? args[0].length : 1,
                },
                "Executing RewardsHub transaction"
            );

            const txHash = await sendTransaction(viemClient, {
                account,
                to: addresses.rewarderHub,
                data,
            });

            const receipt = await waitForTransactionReceipt(viemClient, {
                hash: txHash,
                confirmations: 4,
            });

            log.info(
                {
                    functionName: "batch",
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

export type { PushRewardParams };
export const rewardsHubRepository = new RewardsHubRepository();
