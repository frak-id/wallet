import {
    interactionDiamondRepository,
    log,
    viemClient,
} from "@backend-infrastructure";
import {
    productInteractionDiamond_delegateToFacet,
    productInteractionDiamond_handleInteraction,
} from "@backend-utils";
import { type Address, encodeFunctionData, encodePacked, type Hex } from "viem";
import { simulateContract } from "viem/actions";
import type { InteractionData } from "../types/interactions";

/**
 * The interaction diamonds repositories
 *  - Used to fetch contract address for a given product
 *  - Used to simulate transaction
 */
export class InteractionPackerRepository {
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
            await interactionDiamondRepository.getDiamondContract(productId);
        if (!diamondContract) {
            log.info(
                { productId },
                "[InteractionPackerRepository] No diamond contract found for product"
            );
            return {
                isSimulationSuccess: false,
                failureReason: "No diamond contract found for product",
            };
        }

        // Simulate the interaction execution
        try {
            await simulateContract(viemClient, {
                account: wallet,
                address: diamondContract,
                abi: [productInteractionDiamond_delegateToFacet],
                functionName: "delegateToFacet",
                args: [
                    Number.parseInt(interactionData.handlerTypeDenominator, 16),
                    interactionData.interactionData,
                ],
            });
            return {
                isSimulationSuccess: true,
            };
        } catch (error) {
            log.warn(
                {
                    wallet,
                    productId,
                    interactionData,
                    error,
                },
                "[InteractionPackerRepository] Interaction simulation failed"
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
    }: {
        interactionData: InteractionData;
        signature: Hex;
    }) {
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
