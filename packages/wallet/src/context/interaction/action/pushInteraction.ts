"use server";

import {
    getBundlerClient,
    getPaymasterClient,
} from "@/context/blockchain/aa-provider";
import { frakChainPocClient } from "@/context/blockchain/provider";
import { getInteractionContract } from "@/context/interaction/action/interactionContracts";
import { getSessionStatus } from "@/context/interaction/action/interactionSession";
import { contentInteractionActionAbi } from "@/context/wallet/abi/kernel-v2-abis";
import { interactionSessionSmartAccount } from "@/context/wallet/smartWallet/InteractionSessionSmartWallet";
import type { BuiltInteraction } from "@/types/Interaction";
import { contentInteractionDiamondAbi } from "@frak-labs/shared/context/blockchain/abis/frak-interaction-abis";
import {
    ENTRYPOINT_ADDRESS_V06,
    createSmartAccountClient,
} from "permissionless";
import { sponsorUserOperation } from "permissionless/actions/pimlico";
import { type Address, type Hex, encodeFunctionData, keccak256 } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readContract, signTypedData } from "viem/actions";

/**
 * Try to push an interaction for the given wallet via an interaction
 */
export async function pushInteraction({
    wallet,
    contentId,
    interaction,
}: { wallet: Address; contentId: bigint; interaction: BuiltInteraction }) {
    // Check if the user has a valid session
    const currentSession = await getSessionStatus({
        wallet,
    });
    if (!currentSession) {
        throw new Error("No session available for this user");
    }

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
    // Get an interaction manager
    const interactionContract = await getInteractionContract({ contentId });

    // Get the signature
    const signature = await _getValidationSignature({
        user: wallet,
        facetData: interaction.facetData,
        contentId,
        interactionContract,
    });
    console.log("Data for tx", {
        interaction,
        signature,
    });

    // Build the interaction data
    const interactionTx = encodeFunctionData({
        abi: contentInteractionDiamondAbi,
        functionName: "handleInteraction",
        args: [interaction.interactionData, signature],
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

async function _getValidationSignature({
    facetData,
    contentId,
    user,
    interactionContract,
}: {
    facetData: Hex;
    user: Address;
    contentId: bigint;
    interactionContract: Address;
}): Promise<Hex> {
    const interactionHash = keccak256(facetData);

    // Get the current interaction nonce
    const nonce = await readContract(frakChainPocClient, {
        address: interactionContract,
        abi: contentInteractionDiamondAbi,
        functionName: "getNonceForInteraction",
        args: [interactionHash, user],
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
            interactionData: interactionHash,
            user,
            nonce,
        },
    });
}
