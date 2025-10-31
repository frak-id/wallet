import {
    addresses,
    productInteractionDiamondAbi,
    productInteractionManagerAbi,
} from "@frak-labs/app-essentials";
import { createServerFn } from "@tanstack/react-start";
import { readContract } from "viem/actions";
import { viemClient } from "@/context/blockchain/provider";

/**
 * Get all the attached campaigns on a product
 * @param productId
 */
async function getAttachedCampaignsInternal({
    productId,
}: {
    productId: string;
}) {
    // Get the root interaction contract
    const interactionContract = await readContract(viemClient, {
        address: addresses.productInteractionManager,
        abi: productInteractionManagerAbi,
        functionName: "getInteractionContract",
        args: [BigInt(productId)],
    });
    // Get the current product campaigns
    return readContract(viemClient, {
        address: interactionContract,
        abi: productInteractionDiamondAbi,
        functionName: "getCampaigns",
    });
}

/**
 * Server function to get attached campaigns
 */
export const getAttachedCampaigns = createServerFn({ method: "GET" })
    .inputValidator((input: { productId: string }) => input)
    .handler(async ({ data }) => {
        return getAttachedCampaignsInternal({ productId: data.productId });
    });
