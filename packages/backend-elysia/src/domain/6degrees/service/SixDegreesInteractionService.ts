import { interactionTypes, productTypes } from "@frak-labs/core-sdk";
import type { InteractionData } from "domain/interactions/types/interactions";
import type { KyInstance } from "ky";
import { size, sliceHex, toHex } from "viem";

/**
 * The mapper for frak interaction to 6degrees one
 */
export class SixDegreesInteractionService {
    private readonly referralHandlerType = toHex(productTypes.referral);
    constructor(private readonly api: KyInstance) {}

    /**
     * Push some user interactions
     */
    pushInteraction(interactions: InteractionData[], userToken: string) {
        const mappedInteractions = this.mapInteraction(interactions);
        // Push the interaction to six degrees, the userToken is a Bearer auth token
        this.api.post("/interactions", {
            json: mappedInteractions,
            headers: {
                Authorization: `Bearer ${userToken}`,
            },
        });
    }

    /**
     * Map an interaction to the six degrees format
     */
    private mapInteraction(interactions: InteractionData[]) {
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

                    // todo: the referred address should be longer, representing the b64 pubkey of the webauthn wallet
                    // todo: Should we nap it using mongo authenticator?
                    const wallet = sliceHex(interactionData, 4, 36);
                    return size(wallet) === 32;
                })
                .map(({ interactionData }) => {
                    const wallet = sliceHex(interactionData, 4, 36);
                    return {
                        type: "referred",
                        context: wallet,
                    };
                })
        );
    }
}
