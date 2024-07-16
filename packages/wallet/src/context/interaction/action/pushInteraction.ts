"use server";
import { frakChainPocClient } from "@/context/blockchain/provider";
import { getInteractionContract } from "@/context/interaction/action/interactionContracts";
import { getSessionStatus } from "@/context/interaction/action/interactionSession";
import { getInteractionValidationSignature } from "@/context/interaction/utils/interactionSigner";
import { interactionDelegatorAbi } from "@/context/wallet/abi/kernel-v2-abis";
import type { PreparedInteraction } from "@frak-labs/nexus-sdk/core";
import { contentInteractionDiamondAbi } from "@frak-labs/shared/context/blockchain/abis/frak-interaction-abis";
import { parallel } from "radash";
import * as solady from "solady";
import {
    type Address,
    type Hex,
    type PrivateKeyAccount,
    concatHex,
    encodeAbiParameters,
    encodeFunctionData,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sendTransaction } from "viem/actions";

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
    const sessionStatus = await getSessionStatus({ wallet });
    if (sessionStatus === null) {
        throw new Error("No session available for this user");
    }

    // todo: Only temporary for testing purposes, will be reinforced
    // todo So this shouldn't be the airdropper private key but a KMS aws key
    const sessionPrivateKey = process.env.AIRDROP_PRIVATE_KEY;
    if (!sessionPrivateKey) {
        throw new Error("Missing AIRDROP_PRIVATE_KEY env variable");
    }
    const sessionAccount = privateKeyToAccount(sessionPrivateKey as Hex);

    // If we got a single interactions to push
    if (!Array.isArray(toPush)) {
        // Prepare it
        const interaction = await prepareInteraction({
            wallet,
            toPush,
        });

        // Push it
        return await pushInteractions({
            executor: sessionAccount,
            interactions: [interaction],
        });
    }

    // In the case of multiple interactions
    const interactions = await parallel(4, toPush, async (toPush) =>
        prepareInteraction({
            wallet,
            toPush,
        })
    );

    return await pushInteractions({
        executor: sessionAccount,
        interactions,
    });
}

/**
 * Prepare an interaction to be pushed
 * @param wallet
 * @param toPush
 */
async function prepareInteraction({
    wallet,
    toPush,
}: { wallet: Address; toPush: InteractionToPush }): Promise<{
    wallet: Address;
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
        (await getInteractionValidationSignature({
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

    return { wallet, contentId, data: interactionTx };
}

/**
 * Push an array of interactions
 * @param executor
 * @param interactions
 */
export async function pushInteractions({
    executor,
    interactions,
}: {
    executor: PrivateKeyAccount;
    interactions: {
        wallet: Address;
        contentId: bigint;
        data: Hex;
    }[];
}) {
    // Encode every interactions in the right format for our delegator
    const interactionDatas = interactions.map(({ wallet, contentId, data }) =>
        encodeAbiParameters(
            [
                { name: "wallet", type: "address", value: wallet },
                { name: "contentId", type: "uint256", value: contentId },
                { name: "data", type: "bytes", value: data },
            ],
            [wallet, contentId, data]
        )
    );

    // Encode that in an array
    const encodedInteractions = encodeAbiParameters(
        [{ name: "interactions", type: "bytes[]", value: interactionDatas }],
        [interactionDatas]
    );

    // Compress it using LibZip
    const compressedData = solady.LibZip.cdCompress(encodedInteractions) as Hex;

    // Push it
    return await sendTransaction(frakChainPocClient, {
        account: executor,
        data: encodeFunctionData({
            abi: interactionDelegatorAbi,
            functionName: "execute",
            args: [compressedData],
        }),
    });
}
