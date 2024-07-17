import {
    contentInteractionDiamondAbi,
    contentInteractionManagerAbi,
} from "@frak-labs/shared/context/blockchain/abis/frak-interaction-abis";
import { addresses } from "@frak-labs/shared/context/blockchain/addresses";
import type { SQSRecord } from "aws-lambda";
import { memo } from "radash";
import { type Address, type Hex, concatHex, encodeFunctionData } from "viem";
import { readContract } from "viem/actions";
import { getViemClient } from "../../blockchain/client";
import { getInteractionSignature } from "./interactionSigner";

type InteractionEvent = {
    wallet: Address;
    contentId: Hex;
    interaction: {
        handlerTypeDenominator: Hex;
        interactionData: Hex;
    };
    signature?: Hex;
};

/**
 * Map a record to an interaction
 * @param record
 */
export async function recordToInteraction(record: SQSRecord): Promise<{
    id: string;
    data: {
        wallet: Address;
        contentId: bigint;
        interactionTx: Hex;
    } | null;
}> {
    try {
        // Try to parse the SQS record
        const parsed = JSON.parse(record.body) as InteractionEvent;
        // Ensure our field are present
        if (!(parsed.contentId && parsed.wallet && parsed.interaction)) {
            return {
                id: record.messageId,
                data: null,
            };
        }
        const contentId = BigInt(parsed.contentId);

        // Fetch the interaction contract
        const interactionContract = await getInteractionContract({ contentId });

        // Get the signature if needed
        const signature =
            parsed.signature ??
            (await getInteractionSignature({
                user: parsed.wallet,
                facetData: parsed.interaction.interactionData,
                contentId: contentId,
                interactionContract,
            }));

        // Build the interaction data
        const interactionTx = encodeFunctionData({
            abi: contentInteractionDiamondAbi,
            functionName: "handleInteraction",
            args: [
                concatHex([
                    parsed.interaction.handlerTypeDenominator,
                    parsed.interaction.interactionData,
                ]),
                signature,
            ],
        });

        // Return everything we need to send it
        return {
            id: record.messageId,
            data: {
                wallet: parsed.wallet,
                contentId,
                interactionTx,
            },
        };
    } catch (error) {
        console.error("Error processing record", {
            record,
            error,
        });
        return {
            id: record.messageId,
            data: null,
        };
    }
}

/**
 * Fetch an interaction contract and save it in mem cache
 */
const getInteractionContract = memo(
    async ({ contentId }: { contentId: bigint }) => {
        const client = getViemClient();
        return await readContract(client, {
            address: addresses.contentInteractionManager,
            abi: contentInteractionManagerAbi,
            functionName: "getInteractionContract",
            args: [contentId],
        });
    },
    {
        key: ({ contentId }: { contentId: bigint }) => contentId.toString(),
    }
);
