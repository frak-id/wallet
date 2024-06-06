"use server";

import {
    getBundlerClient,
    getPaymasterClient,
} from "@/context/blockchain/aa-provider";
import {
    contentInteractionAbi,
    contentInteractionManagerAbi,
    pressInteractionAbi,
} from "@/context/blockchain/abis/frak-interaction-abis";
import { addresses } from "@/context/blockchain/addresses";
import { contentIds } from "@/context/blockchain/contentIds";
import { frakChainPocClient } from "@/context/blockchain/provider";
import { contentInteractionActionAbi } from "@/context/wallet/abi/kernel-v2-abis";
import { interactionSessionSmartAccount } from "@/context/wallet/smartWallet/InteractionSessionSmartWallet";
import {
    ENTRYPOINT_ADDRESS_V06,
    createSmartAccountClient,
} from "permissionless";
import { sponsorUserOperation } from "permissionless/actions/pimlico";
import {
    type Address,
    type Hex,
    encodeAbiParameters,
    encodeFunctionData,
    keccak256,
    pad,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readContract, signTypedData } from "viem/actions";

/**
 * Try to push an interaction for the given wallet via an interaction
 */
export async function pushInteraction({ wallet }: { wallet: Address }) {
    // Get our session private account
    const sessionPrivateKey = process.env.AIRDROP_PRIVATE_KEY;
    if (!sessionPrivateKey) {
        throw new Error("Missing AIRDROP_PRIVATE_KEY env variable");
    }
    const sessionAccount = privateKeyToAccount(sessionPrivateKey as Hex);

    // Build the interaction smart wallet
    const smartAccount = interactionSessionSmartAccount(frakChainPocClient, {
        sessionAccount,
        wallet,
    });

    // Get the bundler and paymaster clients
    const chain = frakChainPocClient.chain;
    const { bundlerTransport } = getBundlerClient(chain);
    const paymasterClient = getPaymasterClient(chain);

    // Build the wrapper around smart account to ease the tx flow
    const smartAccountClient = createSmartAccountClient({
        account: smartAccount,
        entryPoint: ENTRYPOINT_ADDRESS_V06,
        chain,
        bundlerTransport,
        // Only add a middleware if the paymaster client is available
        middleware: {
            sponsorUserOperation: (args) =>
                sponsorUserOperation(paymasterClient, args),
        },
    });

    const contentId = contentIds.frak;
    const articleId = pad("0x");

    // Get an interaction manager
    const interactionContract = await readContract(frakChainPocClient, {
        address: addresses.contentInteractionManager,
        abi: contentInteractionManagerAbi,
        functionName: "getInteractionContract",
        args: [contentId],
    });

    // Get the signature
    const referrer: Address = "0xF002C28AEEa942B72f5bAAd95748F78104f91fc6";
    const signature = await _getArticleOpenSignature({
        user: wallet,
        referrer,
        articleId,
        contentId,
        interactionContract,
    });

    // Build the interaction data
    const interactionTx = encodeFunctionData({
        abi: pressInteractionAbi,
        functionName: "articleOpened",
        args: [articleId, referrer, signature],
    });

    // Wrap the call
    const sendInteractionTx = encodeFunctionData({
        abi: contentInteractionActionAbi,
        functionName: "sendInteraction",
        args: [{ contentId, data: interactionTx }],
    });

    // Push it
    console.log("pushing interaction", { sendInteractionTx });
    const txHash = await smartAccountClient.sendTransaction({
        to: wallet,
        data: sendInteractionTx,
    });
    console.log("interaction pushed", { txHash });
}

async function _getArticleOpenSignature({
    user,
    referrer,
    articleId,
    contentId,
    interactionContract,
}: {
    user: Address;
    referrer: Address;
    articleId: Hex;
    contentId: bigint;
    interactionContract: Address;
}): Promise<Hex> {
    // Build the read article interaction data
    const interactionData = keccak256(
        encodeAbiParameters(
            [
                { name: "interactionHash", type: "bytes32" },
                { name: "articleId", type: "bytes32" },
                { name: "referrer", type: "address" },
            ],
            [
                "0xc0a24ffb7afa254ad3052f8f1da6e4268b30580018115d9c10b63352b0004b2d",
                articleId,
                referrer,
            ]
        )
    );
    console.log("interaction data", { interactionData });

    // Get the current interaction nonce
    const nonce = await readContract(frakChainPocClient, {
        address: interactionContract,
        abi: contentInteractionAbi,
        functionName: "getNonceForInteraction",
        args: [interactionData, user],
    });

    // Sign this interaction data
    // todo: Temp, only for testing purpose
    // todo: The signer will be dependant on the contentId, and the signature provider can be an external api endpoint
    const signerAccount = privateKeyToAccount(
        process.env.INTERACTION_VALIDATOR_PRIVATE_KEY as Hex
    );

    return await signTypedData(frakChainPocClient, {
        account: signerAccount,
        domain: {
            name: "Frak.ContentInteraction",
            version: "0.0.1",
            chainId: frakChainPocClient.chain.id,
            verifyingContract: interactionContract,
        },
        types: {
            ValidateInteraction: [
                { name: "contentId", type: "uint256" },
                { name: "interactionData", type: "bytes32" },
                { name: "user", type: "address" },
                { name: "nonce", type: "uint256" },
            ],
        },
        primaryType: "ValidateInteraction",
        message: {
            contentId,
            interactionData,
            user,
            nonce,
        },
    });
}
