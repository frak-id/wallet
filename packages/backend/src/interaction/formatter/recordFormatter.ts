import {
    productInteractionDiamondAbi,
    productInteractionManagerAbi,
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
    productId: Hex;
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
        productId: bigint;
        interactionTx: Hex;
    } | null;
}> {
    try {
        // Try to parse the SQS record
        const parsed = JSON.parse(record.body) as InteractionEvent;
        // Ensure our field are present
        if (!(parsed.productId && parsed.wallet && parsed.interaction)) {
            return {
                id: record.messageId,
                data: null,
            };
        }
        const productId = BigInt(parsed.productId);

        // Fetch the interaction contract
        const interactionContract = await getInteractionContract({ productId });

        // Get the signature if needed
        const signature =
            parsed.signature ??
            (await getInteractionSignature({
                user: parsed.wallet,
                facetData: parsed.interaction.interactionData,
                productId,
                interactionContract,
            }));

        // Build the interaction data
        const interactionTx = encodeFunctionData({
            abi: productInteractionDiamondAbi,
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
                productId: productId,
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
    async ({ productId }: { productId: bigint }) => {
        const client = getViemClient();
        return await readContract(client, {
            address: addresses.contentInteractionManager,
            abi: productInteractionManagerAbi,
            functionName: "getInteractionContract",
            args: [productId],
        });
    },
    {
        key: ({ productId }: { productId: bigint }) => productId.toString(),
    }
);
