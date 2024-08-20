"use server";

import { currentViemClient } from "@/context/blockchain/provider";
import { CachesTags } from "@/context/common/caching";
import { isRunningInProd } from "@/context/common/env";
import { paywallTokenAbi } from "@frak-labs/shared/context/blockchain/abis/frak-gating-abis";
import { addresses } from "@frak-labs/shared/context/blockchain/addresses";
import { revalidateTag } from "next/cache";
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
    // If in prod don't airdrop frk
    if (isRunningInProd) {
        console.log("No token to airdrop in prod");
        return null;
    }

    // Get the airdropper private key
    const airdropperPrivateKey = process.env.AIRDROP_PRIVATE_KEY;
    if (!airdropperPrivateKey) {
        throw new Error("Missing AIRDROP_PRIVATE_KEY env variable");
    }

    // Build our airdrop account
    const airdropperAccount = privateKeyToAccount(airdropperPrivateKey as Hex);

    // Prepare the tx
    const preparationResult = await prepareTransactionRequest(
        currentViemClient,
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
    const txHash = await sendTransaction(currentViemClient, preparationResult);

    // Invalidate user balance cache
    revalidateTag(CachesTags.WALLET_ERC20_BALANCE);

    return txHash;
}
