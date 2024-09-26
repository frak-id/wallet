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

type InteractionData = {
    handlerTypeDenominator: Hex;
    interactionData: Hex;
};

/**
 * The interaction diamonds repositories
 *  - Used to fetch contract address for a given product
 *  - Used to simulate transaction
 */
export class InteractionDiamondRepository {
    private addressCache = new LRUCache<string, Address>({
        max: 256,
        // TTL of 2 hours in prod, 10min in dev
        ttl: isRunningInProd ? 2 * 60 * 60 * 1000 : 10 * 60 * 1000,
    });

    constructor(private readonly client: Client) {}

    /**
     * Get the diamond address for a given product
     * @param productId
     */
    async getDiamondContract(productId: Hex): Promise<Address> {
        const cached = this.addressCache.get(productId);
        if (cached) {
            return cached;
        }

        const address = await readContract(this.client, {
            address: addresses.productInteractionManager,
            abi: productInteractionManagerAbi,
            functionName: "getInteractionContract",
            args: [BigInt(productId)],
        });
        this.addressCache.set(productId, address, {
            // Keep diamond contract in cache for 2 hours
            ttl: 4 * 60 * 60 * 1000,
        });
        return address;
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
