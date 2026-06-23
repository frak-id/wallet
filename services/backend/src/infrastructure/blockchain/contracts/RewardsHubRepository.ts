import { addresses, rewarderHubAbi } from "@frak-labs/app-essentials";
import {
    type Address,
    encodeFunctionData,
    getAddress,
    type Hex,
    TransactionNotFoundError,
    TransactionReceiptNotFoundError,
} from "viem";
import {
    getTransaction,
    getTransactionReceipt,
    sendTransaction,
    waitForTransactionReceipt,
} from "viem/actions";
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

type PushRewardsOptions = {
    confirmations: number;
    /**
     * Persists the broadcast tx hash before the receipt wait. A crash mid-wait
     * then leaves a `processing` row carrying its hash, so recovery reconciles
     * it against the chain instead of blindly re-sending (double-pay).
     */
    onBroadcast?: (txHash: Hex) => Promise<void>;
};

/**
 * Broadcast outcome. `timeout` means the tx was broadcast but no receipt was
 * seen in time (or the RPC failed) — the funds may still move, so the caller
 * must NOT revert; reconciliation decides later from the persisted hash.
 */
type SettlementTxResult =
    | { status: "confirmed"; txHash: Hex; blockNumber: bigint }
    | { status: "timeout"; txHash: Hex }
    | { status: "reverted"; txHash: Hex };

type SettlementReceipt = {
    status: "success" | "reverted";
    blockNumber: bigint;
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
    async pushRewards(
        rewards: PushRewardParams[],
        options: PushRewardsOptions
    ): Promise<SettlementTxResult> {
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
        return this.executeTransaction(sortedOps, options);
    }

    /**
     * `null` strictly means "the chain has no receipt for this hash". Any
     * other failure (RPC down, timeout) is rethrown — reconciliation must
     * not mistake an unreachable RPC for a dropped tx and re-send.
     */
    async getReceipt(txHash: Hex): Promise<SettlementReceipt | null> {
        try {
            const receipt = await getTransactionReceipt(viemClient, {
                hash: txHash,
            });
            return {
                status: receipt.status,
                blockNumber: receipt.blockNumber,
            };
        } catch (error) {
            if (error instanceof TransactionReceiptNotFoundError) return null;
            throw error;
        }
    }

    /** `false` strictly means "no node knows this tx"; RPC failures rethrow. */
    async isTransactionKnown(txHash: Hex): Promise<boolean> {
        try {
            await getTransaction(viemClient, { hash: txHash });
            return true;
        } catch (error) {
            if (error instanceof TransactionNotFoundError) return false;
            throw error;
        }
    }

    private async executeTransaction(
        args: RewardOp[],
        options: PushRewardsOptions
    ): Promise<SettlementTxResult> {
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

        // Best-effort persist of the hash before awaiting; a failure here is
        // recovered by the settled-status write, so it must not abort the wait.
        try {
            await options.onBroadcast?.(txHash);
        } catch (error) {
            log.error(
                { error, txHash },
                "Failed to persist settlement tx hash before receipt wait"
            );
        }

        try {
            const receipt = await waitForTransactionReceipt(viemClient, {
                hash: txHash,
                confirmations: options.confirmations,
                timeout: RECEIPT_TIMEOUT_MS,
            });

            log.info(
                {
                    functionName: "batch",
                    txHash,
                    blockNumber: receipt.blockNumber,
                    gasUsed: receipt.gasUsed,
                    status: receipt.status,
                },
                "RewardsHub transaction mined"
            );

            return receipt.status === "success"
                ? {
                      status: "confirmed",
                      txHash,
                      blockNumber: receipt.blockNumber,
                  }
                : { status: "reverted", txHash };
        } catch (error) {
            // Broadcast succeeded but the receipt is unknown (timeout/RPC error).
            // Re-sending could double-pay, so hand off to reconciliation.
            log.warn(
                { error, txHash },
                "Settlement receipt unresolved; leaving for reconciliation"
            );
            return { status: "timeout", txHash };
        }
    }
}

export type { PushRewardParams, SettlementTxResult };
export const rewardsHubRepository = new RewardsHubRepository();
