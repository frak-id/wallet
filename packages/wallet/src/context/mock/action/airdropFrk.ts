"use server";

import { addresses } from "@/context/common/blockchain/addresses";
import { paywallTokenAbi } from "@/context/common/blockchain/poc-abi";
import { arbSepoliaPocClient } from "@/context/common/blockchain/provider";
import { type Address, type Hex, encodeFunctionData, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { prepareTransactionRequest, sendTransaction } from "viem/actions";
import { arbitrumSepolia } from "viem/chains";

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
    const preparationResult = await prepareTransactionRequest(
        arbSepoliaPocClient,
        {
            account: airdropperAccount,
            chain: arbitrumSepolia,
            to: addresses.paywallToken,
            data: encodeFunctionData({
                abi: paywallTokenAbi,
                functionName: "mint",
                args: [user, parseEther(amount)],
            }),
        }
    );

    // Send the tx
    const txHash = await sendTransaction(
        arbSepoliaPocClient,
        preparationResult
    );
    return { txHash };
}
