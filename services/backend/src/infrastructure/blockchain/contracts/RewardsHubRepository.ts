import { log, viemClient } from "@backend-infrastructure";
import { isRunningInProd } from "@frak-labs/app-essentials";
import { type Abi, type Address, type Hex, encodeFunctionData } from "viem";
import { sendTransaction, waitForTransactionReceipt } from "viem/actions";
import { adminWalletsRepository } from "../../keys/AdminWalletsRepository";

const REWARDER_KEY = "rewarder" as const;

const REWARDS_HUB_ADDRESS: Address = isRunningInProd
    ? "0x0000000000000000000000000000000000000000" // TODO: Deploy to mainnet
    : "0x0000000000000000000000000000000000000000"; // TODO: Deploy to testnet

const RewardsHubAbi = [
    {
        name: "pushReward",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "wallet", type: "address" },
            { name: "amount", type: "uint256" },
            { name: "token", type: "address" },
            { name: "bank", type: "address" },
            { name: "attestation", type: "bytes" },
        ],
        outputs: [],
    },
    {
        name: "pushRewards",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            {
                name: "rewards",
                type: "tuple[]",
                components: [
                    { name: "wallet", type: "address" },
                    { name: "amount", type: "uint256" },
                    { name: "token", type: "address" },
                    { name: "bank", type: "address" },
                    { name: "attestation", type: "bytes" },
                ],
            },
        ],
        outputs: [],
    },
    {
        name: "lockReward",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "userId", type: "bytes32" },
            { name: "amount", type: "uint256" },
            { name: "token", type: "address" },
            { name: "bank", type: "address" },
            { name: "attestation", type: "bytes" },
        ],
        outputs: [],
    },
    {
        name: "lockRewards",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            {
                name: "locks",
                type: "tuple[]",
                components: [
                    { name: "userId", type: "bytes32" },
                    { name: "amount", type: "uint256" },
                    { name: "token", type: "address" },
                    { name: "bank", type: "address" },
                    { name: "attestation", type: "bytes" },
                ],
            },
        ],
        outputs: [],
    },
    {
        name: "resolveUserId",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "userId", type: "bytes32" },
            { name: "wallet", type: "address" },
        ],
        outputs: [],
    },
] as const satisfies Abi;

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

export class RewardsHubRepository {
    private readonly contractAddress: Address;

    constructor(contractAddress?: Address) {
        this.contractAddress = contractAddress ?? REWARDS_HUB_ADDRESS;
    }

    async pushReward(params: PushRewardParams): Promise<{
        txHash: Hex;
        blockNumber: bigint;
    }> {
        return this.executeTransaction("pushReward", [
            params.wallet,
            params.amount,
            params.token,
            params.bank,
            params.attestation,
        ]);
    }

    async pushRewards(rewards: PushRewardParams[]): Promise<{
        txHash: Hex;
        blockNumber: bigint;
    }> {
        if (rewards.length === 0) {
            throw new Error("No rewards to push");
        }

        if (rewards.length === 1) {
            return this.pushReward(rewards[0]);
        }

        const rewardsData = rewards.map((r) => ({
            wallet: r.wallet,
            amount: r.amount,
            token: r.token,
            bank: r.bank,
            attestation: r.attestation,
        }));

        return this.executeTransaction("pushRewards", [rewardsData]);
    }

    async lockReward(params: LockRewardParams): Promise<{
        txHash: Hex;
        blockNumber: bigint;
    }> {
        return this.executeTransaction("lockReward", [
            params.userId,
            params.amount,
            params.token,
            params.bank,
            params.attestation,
        ]);
    }

    async lockRewards(locks: LockRewardParams[]): Promise<{
        txHash: Hex;
        blockNumber: bigint;
    }> {
        if (locks.length === 0) {
            throw new Error("No locks to process");
        }

        if (locks.length === 1) {
            return this.lockReward(locks[0]);
        }

        const locksData = locks.map((l) => ({
            userId: l.userId,
            amount: l.amount,
            token: l.token,
            bank: l.bank,
            attestation: l.attestation,
        }));

        return this.executeTransaction("lockRewards", [locksData]);
    }

    async resolveUserId(params: { userId: Hex; wallet: Address }): Promise<{
        txHash: Hex;
        blockNumber: bigint;
    }> {
        return this.executeTransaction("resolveUserId", [
            params.userId,
            params.wallet,
        ]);
    }

    private async executeTransaction(
        functionName: string,
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
                abi: RewardsHubAbi,
                functionName: functionName as
                    | "pushReward"
                    | "pushRewards"
                    | "lockReward"
                    | "lockRewards"
                    | "resolveUserId",
                args: args as never,
            });

            log.debug(
                {
                    functionName,
                    contractAddress: this.contractAddress,
                    account: account.address,
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

export const rewardsHubRepository = new RewardsHubRepository();
