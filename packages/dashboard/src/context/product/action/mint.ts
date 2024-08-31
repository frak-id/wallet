"use server";
import { getSafeSession } from "@/context/auth/actions/session";
import { viemClient } from "@/context/blockchain/provider";
import { isDnsTxtRecordSet } from "@/context/product/action/verifyDomain";
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
 * Mint a new product for the given user
 * @param name
 * @param domain
 * @param productTypes
 */
export async function mintProduct({
    name,
    domain,
    productTypes,
}: {
    name: string;
    domain: string;
    productTypes: bigint;
}) {
    const session = await getSafeSession();

    // Precompute the domain id and check if it's already minted or not
    const productId = BigInt(keccak256(toHex(domain)));
    const alreadyExist = await isExistingProduct({ productId: productId });
    if (alreadyExist) {
        throw new Error(
            `The product ${name} already exists for the domain ${domain}`
        );
    }

    // Check if the DNS txt record is set
    const isRecordSet = await isDnsTxtRecordSet({ name, domain });
    if (!isRecordSet) {
        throw new Error(
            `The DNS txt record is not set for the domain ${domain}`
        );
    }

    console.log(`Minting product ${name} for ${session.wallet}`, {
        productId,
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
            args: [productTypes, name, domain, session.wallet],
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
        args: [productId],
    });

    return { mintTxHash, setupInteractionTxData };
}

/**
 * Assert that a product doesn't exist yet
 * @param contentId
 */
export async function isExistingProduct({ productId }: { productId: bigint }) {
    const existingMetadata = await readContract(viemClient, {
        address: addresses.contentRegistry,
        abi: contentRegistryAbi,
        functionName: "getMetadata",
        args: [BigInt(productId)],
    });
    // Return true if the existing metadata exists
    return existingMetadata.contentTypes !== 0n;
}
