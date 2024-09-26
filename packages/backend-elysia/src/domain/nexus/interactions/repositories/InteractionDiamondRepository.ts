import {
    addresses,
    isRunningInProd,
    productInteractionDiamondAbi,
    productInteractionManagerAbi,
} from "@frak-labs/app-essentials";
import { LRUCache } from "lru-cache";
import {
    type Address,
    type Client,
    type Hex,
    encodeFunctionData,
    encodePacked,
} from "viem";
import { readContract, simulateContract } from "viem/actions";
import type { InteractionData } from "../types/interactions";

/**
 * The interaction diamonds repositories
 *  - Used to fetch contract address for a given product
 *  - Used to simulate transaction
 */
export class InteractionDiamondRepository {
    private addressCache = new LRUCache<string, { address?: Address }>({
        max: 256,
        // TTL of 2 hours in prod, 10min in dev
        ttl: isRunningInProd ? 2 * 60 * 60 * 1000 : 10 * 60 * 1000,
    });

    constructor(private readonly client: Client) {}

    /**
     * Get the diamond address for a given product
     * @param productId
     */
    async getDiamondContract(productId: Hex): Promise<Address | undefined> {
        const cached = this.addressCache.get(productId);
        if (cached) {
            return cached.address;
        }

        try {
            const address = await readContract(this.client, {
                address: addresses.productInteractionManager,
                abi: productInteractionManagerAbi,
                functionName: "getInteractionContract",
                args: [BigInt(productId)],
            });
            this.addressCache.set(productId, { address });
            return address;
        } catch (e) {
            console.error("Failed to get diamond contract", {
                productId,
                error: e,
            });
            this.addressCache.set(productId, { address: undefined });
        }
        return undefined;
    }

    /**
     * Simulate an interaction
     * @param wallet
     * @param productId
     * @param interactionData
     */
    async simulateInteraction({
        wallet,
        productId,
        interactionData,
    }: {
        wallet: Address;
        productId: Hex;
        interactionData: InteractionData;
    }) {
        const diamondContract = await this.getDiamondContract(productId);
        if (!diamondContract) {
            return {
                isSimulationSuccess: false,
            };
        }

        try {
            await simulateContract(this.client, {
                account: wallet,
                address: diamondContract,
                abi: productInteractionDiamondAbi,
                functionName: "delegateToFacet",
                args: [
                    Number.parseInt(interactionData.handlerTypeDenominator),
                    interactionData.interactionData,
                ],
            });
            return {
                isSimulationSuccess: true,
            };
        } catch (e) {
            console.error("Interaction simulation failed", {
                wallet,
                productId,
                interactionData,
                error: e,
            });
            return {
                isSimulationSuccess: false,
            };
        }
    }

    /**
     * Package ome interaction data to be rdy to be handled
     * @param interactionData
     * @param signature
     */
    packageInteractionData({
        interactionData,
        signature,
    }: { interactionData: InteractionData; signature: Hex }) {
        return encodeFunctionData({
            abi: productInteractionDiamondAbi,
            functionName: "handleInteraction",
            args: [
                encodePacked(
                    ["uint8", "bytes"],
                    [
                        Number(interactionData.handlerTypeDenominator),
                        interactionData.interactionData,
                    ]
                ),
                signature,
            ],
        });
    }
}
