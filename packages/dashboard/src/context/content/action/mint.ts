"use server";
import { getSafeSession } from "@/context/auth/actions/session";
import { viemClient } from "@/context/blockchain/provider";
import { isDnsTxtRecordSet } from "@/context/content/action/verifyDomain";
import { contentInteractionManagerAbi } from "@frak-labs/shared/context/blockchain/abis/frak-interaction-abis";
import { contentRegistryAbi } from "@frak-labs/shared/context/blockchain/abis/frak-registry-abis";
import { addresses } from "@frak-labs/shared/context/blockchain/addresses";
import { type Hex, encodeFunctionData, keccak256, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
    prepareTransactionRequest,
    readContract,
    sendTransaction,
    waitForTransactionReceipt,
} from "viem/actions";

/**
 * Mint a new content for the given user
 * @param name
 * @param domain
 * @param contentTypes
 * @param setupInteractions
 */
export async function mintMyContent({
    name,
    domain,
    contentTypes,
}: {
    name: string;
    domain: string;
    contentTypes: bigint;
}) {
    const session = await getSafeSession();

    // Precompute the domain id and check if it's already minted or not
    const contentId = BigInt(keccak256(toHex(domain)));
    await assertContentDoesntExist({ contentId });

    // Check if the DNS txt record is set
    const isRecordSet = await isDnsTxtRecordSet({ name, domain });
    if (!isRecordSet) {
        throw new Error(
            `The DNS txt record is not set for the domain ${domain}`
        );
    }

    console.log(`Minting content ${name} for ${session.wallet}`, {
        contentId,
    });

    // Get the minter private key
    const minterPrivateKey = process.env.CONTENT_MINTER_PRIVATE_KEY;
    if (!minterPrivateKey) {
        throw new Error("Missing CONTENT_MINTER_PRIVATE_KEY env variable");
    }
    const minterAccount = privateKeyToAccount(minterPrivateKey as Hex);

    // Prepare the mint tx and send it
    const mintTxPreparation = await prepareTransactionRequest(viemClient, {
        account: minterAccount,
        chain: viemClient.chain,
        to: addresses.contentRegistry,
        data: encodeFunctionData({
            abi: contentRegistryAbi,
            functionName: "mint",
            args: [contentTypes, name, domain, session.wallet],
        }),
    });
    const mintTxHash = await sendTransaction(viemClient, mintTxPreparation);
    // Wait for the mint to be done before proceeding to the transfer
    await waitForTransactionReceipt(viemClient, {
        hash: mintTxHash,
        confirmations: 1,
    });

    // Prepare the interaction setup tx data
    const setupInteractionTxData = encodeFunctionData({
        abi: contentInteractionManagerAbi,
        functionName: "deployInteractionContract",
        args: [contentId],
    });

    return { mintTxHash, setupInteractionTxData };
}

/**
 * Assert that a content doesn't exist yet
 * @param contentId
 */
async function assertContentDoesntExist({ contentId }: { contentId: bigint }) {
    const existingMetadata = await readContract(viemClient, {
        address: addresses.contentRegistry,
        abi: contentRegistryAbi,
        functionName: "getMetadata",
        args: [BigInt(contentId)],
    });
    if (existingMetadata.contentTypes !== 0n) {
        throw new Error("Content already minted");
    }
}
