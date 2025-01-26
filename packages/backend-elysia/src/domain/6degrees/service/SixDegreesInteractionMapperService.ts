import { interactionTypes, productTypes } from "@frak-labs/core-sdk";
import type { InteractionData } from "domain/interactions/types/interactions";
import { size, sliceHex, toHex } from "viem";

/**
 * The mapper for frak interaction to 6degrees one
 */
export class SixDegreesInteractionMapperService {
    private readonly referralHandlerType = toHex(productTypes.referral);

    /**
     * Map an interaction
     */
    mapInteraction(interactions: InteractionData[]) {
        return (
            interactions
                // Pre filter to only get referral related interactions
                .filter(({ handlerTypeDenominator }) => {
                    return handlerTypeDenominator === this.referralHandlerType;
                })
                .filter(({ interactionData }) => {
                    // Ensure the interaction data start with `referred`
                    const interactionType = sliceHex(interactionData, 0, 4);
                    if (
                        interactionType !== interactionTypes.referral.referred
                    ) {
                        return false;
                    }

                    // Ensure we got a wallet on 32 bytes after the `referred` type
                    const wallet = sliceHex(interactionData, 4, 36);
                    return size(wallet) === 32;
                })
                // todo: Mapping output?
                .map((interaction) => {
                    return {
                        handlerTypeDenominator:
                            interaction.handlerTypeDenominator,
                        interactionData: interaction.interactionData,
                    };
                })
        );
    }
}
