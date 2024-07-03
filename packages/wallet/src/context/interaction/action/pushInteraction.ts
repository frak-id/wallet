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
import type { PreparedInteraction } from "@frak-labs/nexus-sdk/core";
import { contentInteractionDiamondAbi } from "@frak-labs/shared/context/blockchain/abis/frak-interaction-abis";
import {
    ENTRYPOINT_ADDRESS_V06,
    createSmartAccountClient,
} from "permissionless";
import { sponsorUserOperation } from "permissionless/actions/pimlico";
import { parallel } from "radash";
import {
    type Address,
    type Hex,
    concatHex,
    encodeFunctionData,
    keccak256,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readContract, signTypedData } from "viem/actions";

type InteractionToPush = {
    contentId: Hex;
    interaction: PreparedInteraction;
    submittedSignature?: Hex;
};

/**
 * Try to push an interaction for the given wallet via an interaction
 */
export async function pushInteraction({
    wallet,
    toPush,
}: {
    wallet: Address;
    toPush: InteractionToPush | InteractionToPush[];
}) {
    // Check if the user has a valid session
    const walletClient = await _getSafeSessionWalletClient({ wallet });

    // If we got a single interactions to push
    if (!Array.isArray(toPush)) {
        // Prepare it
        const { contentId, data } = await _prepareInteraction({
            wallet: walletClient.account.address,
            toPush,
        });

        // Push it
        return await walletClient.sendTransaction({
            to: wallet,
            data: encodeFunctionData({
                abi: contentInteractionActionAbi,
                functionName: "sendInteraction",
                args: [{ contentId, data }],
            }),
        });
    }

    // In the case of multiple interactions
    const interactions = await parallel(4, toPush, async (toPush) =>
        _prepareInteraction({
            wallet: walletClient.account.address,
            toPush,
        })
    );

    // Push it
    return await walletClient.sendTransaction({
        to: wallet,
        data: encodeFunctionData({
            abi: contentInteractionActionAbi,
            functionName: "sendInteractions",
            args: [interactions],
        }),
    });
}
/**
 * Get the safe session wallet client
 */
async function _getSafeSessionWalletClient({
    wallet,
}: {
    wallet: Address;
}) {
    const sessionStatus = await getSessionStatus({ wallet });
    if (!sessionStatus) {
        throw new Error("No session available for this user");
    }

    // Get our session private account
    const sessionPrivateKey = process.env.AIRDROP_PRIVATE_KEY;
    if (!sessionPrivateKey) {
        throw new Error("Missing AIRDROP_PRIVATE_KEY env variable");
    }
    const sessionAccount = privateKeyToAccount(sessionPrivateKey as Hex);

    // Get the bundler and paymaster clients
    const chain = frakChainPocClient.chain;
    const { bundlerTransport } = getBundlerClient(chain);
    const paymasterClient = getPaymasterClient(chain);

    // Build the interaction smart wallet
    const smartAccount = interactionSessionSmartAccount(frakChainPocClient, {
        sessionAccount,
        wallet,
    });

    // Build the wrapper around smart account to ease the tx flow
    return createSmartAccountClient({
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
}

/**
 * Prepare an interaction to be pushed
 * @param wallet
 * @param toPush
 */
async function _prepareInteraction({
    wallet,
    toPush,
}: { wallet: Address; toPush: InteractionToPush }): Promise<{
    contentId: bigint;
    data: Hex;
}> {
    // todo: Should simulate the interaction to ensure it will pass
    const contentId = BigInt(toPush.contentId);

    // Get an interaction manager
    const interactionContract = await getInteractionContract({ contentId });

    // Get the signature
    const signature =
        toPush.submittedSignature ??
        (await _getValidationSignature({
            user: wallet,
            facetData: toPush.interaction.interactionData,
            contentId,
            interactionContract,
        }));

    // Build the interaction data
    const interactionTx = encodeFunctionData({
        abi: contentInteractionDiamondAbi,
        functionName: "handleInteraction",
        args: [
            concatHex([
                toPush.interaction.handlerTypeDenominator,
                toPush.interaction.interactionData,
            ]),
            signature,
        ],
    });

    return { contentId, data: interactionTx };
}

/**
 * Generate an interaction validation
 * @param facetData
 * @param contentId
 * @param user
 * @param interactionContract
 */
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
    // todo: Should ensure we can generate signature for the given `contentId`

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
