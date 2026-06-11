import { addresses, rewarderHubAbi } from "@frak-labs/app-essentials";
import { type Address, encodeFunctionData, getAddress, type Hex } from "viem";
import { sendTransaction, waitForTransactionReceipt } from "viem/actions";
import { log } from "../../external/logger";
import { adminWalletsRepository } from "../../keys/AdminWalletsRepository";
import { viemClient } from "../client";

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

/**
 * Upper bound on the confirmation wait. viem already defaults to 180s, but we
 * pin it explicitly so a stalled RPC can't keep a settlement run parked for
 * the full default; on timeout viem throws and the batch reverts to `pending`.
 */
const RECEIPT_TIMEOUT_MS = 120_000;

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
            target: getAddress(r.wallet),
            amount: r.amount,
            token: r.token,
            bank: r.bank,
            attestation: r.attestation,
        }));

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

        // The mutex exists only to serialize nonce allocation on the shared
        // rewarder EOA, so it must wrap the broadcast and nothing more. Holding
        // it across `waitForTransactionReceipt` would block every other
        // settlement push for the entire confirmation window (or a stalled-RPC
        // timeout), which is exactly the head-of-line stall we are avoiding.
        const txHash = await mutex.runExclusive(async () => {
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
                    opsCount: args.length,
                },
                "Executing RewardsHub transaction"
            );

            return sendTransaction(viemClient, {
                account,
                to: addresses.rewarderHub,
                data,
                chain: viemClient.chain,
            });
        });

        const receipt = await waitForTransactionReceipt(viemClient, {
            hash: txHash,
            confirmations: 4,
            timeout: RECEIPT_TIMEOUT_MS,
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
    }
}

export type { PushRewardParams };
export const rewardsHubRepository = new RewardsHubRepository();
