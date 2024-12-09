import { log } from "@backend-common";
import type { InteractionDiamondRepository } from "@backend-common/repositories";
import {
    productInteractionDiamond_delegateToFacet,
    productInteractionDiamond_handleInteraction,
} from "@backend-utils";
import {
    type Address,
    type Client,
    type Hex,
    encodeFunctionData,
    encodePacked,
} from "viem";
import { simulateContract } from "viem/actions";
import type { InteractionData } from "../types/interactions";

/**
 * The interaction diamonds repositories
 *  - Used to fetch contract address for a given product
 *  - Used to simulate transaction
 */
export class InteractionPackerRepository {
    constructor(
        private readonly client: Client,
        private readonly diamondRepository: InteractionDiamondRepository
    ) {}

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
        const diamondContract =
            await this.diamondRepository.getDiamondContract(productId);
        if (!diamondContract) {
            log.info({ productId }, "No diamond contract found for product");
            return {
                isSimulationSuccess: false,
            };
        }

        try {
            await simulateContract(this.client, {
                account: wallet,
                address: diamondContract,
                abi: [productInteractionDiamond_delegateToFacet],
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
            log.warn(
                {
                    wallet,
                    productId,
                    interactionData,
                    error: e,
                },
                "Interaction simulation failed"
            );
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
            abi: [productInteractionDiamond_handleInteraction],
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
