"use server";

import { addresses } from "@/context/common/blockchain/addresses";
import { mumbaiPocClient } from "@/context/common/blockchain/provider";
import { type Address, type Hex, encodeFunctionData, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { prepareTransactionRequest, sendTransaction } from "viem/actions";
import { polygonMumbai } from "viem/chains";

/**
 * Abi used to trigger an airdrop from the treasury contract
 */
const airdropAbi = {
    stateMutability: "nonpayable",
    type: "function",
    inputs: [
        { name: "target", internalType: "address", type: "address" },
        { name: "amount", internalType: "uint256", type: "uint256" },
    ],
    name: "transfer",
    outputs: [],
} as const;

/**
 * Trigger a frk airdrop to a user
 * @param user
 * @param amount
 */
export async function triggerFrkAirdrop({
    user,
    amount,
}: { user: Address; amount: string }) {
    /// TODO: Can we use SST Config. here? To prevent replication in the local env
    const airdropperPrivateKey = process.env.AIRDROP_PRIVATE_KEY;
    if (!airdropperPrivateKey) {
        throw new Error("Missing AIRDROP_PRIVATE_KEY env variable");
    }

    // Build our airdrop account
    const airdropperAccount = privateKeyToAccount(airdropperPrivateKey as Hex);

    // Prepare the tx
    const preparationResult = await prepareTransactionRequest(mumbaiPocClient, {
        account: airdropperAccount,
        chain: polygonMumbai,
        to: addresses.frakTreasuryWallet,
        data: encodeFunctionData({
            abi: [airdropAbi],
            functionName: "transfer",
            args: [user, parseEther(amount)],
        }),
    });

    // Send the tx
    const txHash = await sendTransaction(mumbaiPocClient, preparationResult);
    return { txHash };
}
