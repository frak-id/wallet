"use server";
import { getInteractionContract } from "@/context/interaction/action/interactionContracts";
import { getInteractionSessionClient } from "@/context/interaction/utils/interactionSession";
import { getInteractionValidationSignature } from "@/context/interaction/utils/interactionSigner";
import { contentInteractionActionAbi } from "@/context/wallet/abi/kernel-v2-abis";
import type { PreparedInteraction } from "@frak-labs/nexus-sdk/core";
import { contentInteractionDiamondAbi } from "@frak-labs/shared/context/blockchain/abis/frak-interaction-abis";
import { parallel } from "radash";
import { type Address, type Hex, concatHex, encodeFunctionData } from "viem";

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
    const walletClient = await getInteractionSessionClient({ wallet });

    // If we got a single interactions to push
    if (!Array.isArray(toPush)) {
        // Prepare it
        const { contentId, data } = await prepareInteraction({
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
        prepareInteraction({
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
 * Prepare an interaction to be pushed
 * @param wallet
 * @param toPush
 */
async function prepareInteraction({
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

    return { contentId, data: interactionTx };
}
