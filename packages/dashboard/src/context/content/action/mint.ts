"use server";

import * as dns from "node:dns";
import { promisify } from "node:util";
import { getSafeSession } from "@/context/auth/actions/session";
import { frakChainPocClient } from "@frak-labs/nexus-wallet/src/context/blockchain/provider";
import { contentInteractionManagerAbi } from "@frak-labs/shared/context/blockchain/abis/frak-interaction-abis";
import { contentRegistryAbi } from "@frak-labs/shared/context/blockchain/abis/frak-registry-abis";
import { addresses } from "@frak-labs/shared/context/blockchain/addresses";
import { flat } from "radash";
import {
    type Address,
    type Hex,
    concatHex,
    encodeFunctionData,
    keccak256,
    toHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
    prepareTransactionRequest,
    readContract,
    sendTransaction,
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
    setupInteractions = true,
}: {
    name: string;
    domain: string;
    contentTypes: bigint;
    setupInteractions?: boolean;
}) {
    const session = await getSafeSession();

    // Precompute the domain id and check if it's already minted or not
    const contentId = BigInt(keccak256(toHex(domain)));
    await assertContentDoesntExist({ contentId });

    const waitedTxtRecord = await getDnsTxtString({
        domain,
        wallet: session.wallet,
    });

    // Ensure the DNS txt record is set
    const records = flat(await promisify(dns.resolveTxt)(domain));
    if (!records.includes(waitedTxtRecord)) {
        throw new Error(
            `The DNS txt record is not set for the domain ${domain}`
        );
    }

    console.log(`Minting content ${name} for ${session.wallet}`, {
        setupInteractions,
    });

    // Get the airdropper private key
    const airdropperPrivateKey = process.env.AIRDROP_PRIVATE_KEY;
    if (!airdropperPrivateKey) {
        throw new Error("Missing AIRDROP_PRIVATE_KEY env variable");
    }
    const airdropperAccount = privateKeyToAccount(airdropperPrivateKey as Hex);

    // Prepare the mint tx and send it
    const mintTxPreparation = await prepareTransactionRequest(
        frakChainPocClient,
        {
            account: airdropperAccount,
            chain: frakChainPocClient.chain,
            to: addresses.contentRegistry,
            data: encodeFunctionData({
                abi: contentRegistryAbi,
                functionName: "mint",
                args: [contentTypes, name, domain],
            }),
        }
    );
    const mintTxHash = await sendTransaction(
        frakChainPocClient,
        mintTxPreparation
    );

    // Then prepare the transfer tx and send it
    const transferTxPreparation = await prepareTransactionRequest(
        frakChainPocClient,
        {
            account: airdropperAccount,
            chain: frakChainPocClient.chain,
            to: addresses.contentRegistry,
            data: encodeFunctionData({
                abi: contentRegistryAbi,
                functionName: "transferFrom",
                args: [airdropperAccount.address, session.wallet, contentId],
            }),
        }
    );
    const transferTxHash = await sendTransaction(
        frakChainPocClient,
        transferTxPreparation
    );

    // Prepare the interaction setup tx data
    const setupInteractionTxData = encodeFunctionData({
        abi: contentInteractionManagerAbi,
        functionName: "deployInteractionContract",
        args: [contentId],
    });

    return { mintTxHash, transferTxHash, setupInteractionTxData };
}

/**
 * Assert that a content doesn't exist yet
 * @param contentId
 */
async function assertContentDoesntExist({ contentId }: { contentId: bigint }) {
    const existingMetadata = await readContract(frakChainPocClient, {
        address: addresses.contentRegistry,
        abi: contentRegistryAbi,
        functionName: "getMetadata",
        args: [BigInt(contentId)],
    });
    if (existingMetadata) {
        throw new Error("Content already minted");
    }
}

/**
 * Get the DNS txt record waited for the given domain
 */
export async function getDnsTxtString({
    domain,
    wallet,
}: { domain: string; wallet?: Address }) {
    const safeWallet = wallet ?? (await getSafeSession()).wallet;
    const hash = keccak256(concatHex([toHex(domain), toHex(safeWallet)]));
    return `frak-business hash=${hash}`;
}
