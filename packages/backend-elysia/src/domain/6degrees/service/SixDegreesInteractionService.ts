import { log } from "@backend-common";
import { WebAuthN } from "@frak-labs/app-essentials";
import { interactionTypes, productTypes } from "@frak-labs/core-sdk";
import type { AuthenticatorRepository } from "domain/auth/repositories/AuthenticatorRepository";
import type { InteractionData } from "domain/interactions/types/interactions";
import type { KyInstance } from "ky";
import { size, sliceHex, toHex } from "viem";

/**
 * The mapper for frak interaction to 6degrees one
 */
export class SixDegreesInteractionService {
    private readonly referralHandlerType = toHex(productTypes.referral);
    private readonly knwownHandlerType = [
        this.referralHandlerType,
        toHex(productTypes.webshop),
        toHex(productTypes.press),
    ];
    constructor(
        private readonly api: KyInstance,
        private readonly authenticatorRepository: AuthenticatorRepository
    ) {}

    /**
     * Push some user interactions
     */
    async pushInteraction(interactions: InteractionData[], userToken: string) {
        const mappedInteractions = await Promise.all(
            this.mapInteractions(interactions)
        );
        // Push the interaction to six degrees, the userToken is a Bearer auth token
        for (const interaction of mappedInteractions) {
            try {
                this.api.post("api/users/webauthn/interactions", {
                    json: {
                        ...interaction,
                        context: {
                            rpId: WebAuthN.rpId,
                            rpOrigin: WebAuthN.rpOrigin,
                            domain: WebAuthN.rpId,
                        },
                    },
                    headers: {
                        Authorization: `Bearer ${userToken}`,
                    },
                });
            } catch (e) {
                log.warn({ e }, "Failed to push interaction");
            }
        }
    }

    /**
     * Map an interaction to the six degrees format
     */
    private mapInteractions(interactions: InteractionData[]) {
        return (
            interactions
                // Pre filter to only get the knwon interaction
                .filter(({ handlerTypeDenominator }) => {
                    return this.knwownHandlerType.includes(
                        handlerTypeDenominator
                    );
                })
                // Filter for the referred interaction on every referral type handler
                .filter(({ interactionData }) => {
                    // If that's not a referral interaction, we don't care of this filter
                    const interactionType = sliceHex(interactionData, 0, 4);
                    if (
                        interactionType !== interactionTypes.referral.referred
                    ) {
                        return true;
                    }

                    // Ensure we got a valdi wallet address
                    const wallet = sliceHex(interactionData, 4, 36);
                    return size(wallet) === 32;
                })
                .map(async ({ interactionData }) => {
                    try {
                        // If that's not a referral interaction, we map it to a login interaction
                        const interactionType = sliceHex(interactionData, 0, 4);
                        if (
                            interactionType !==
                            interactionTypes.referral.referred
                        ) {
                            return { type: "login" };
                        }

                        // Get the wallet from the interaction data
                        const wallet = sliceHex(interactionData, -20);
                        const authenticator =
                            await this.authenticatorRepository.getByWallet({
                                wallet,
                            });
                        if (!authenticator) {
                            return { type: "login" };
                        }

                        return {
                            type: "referred",
                            referrerPublicKey: Buffer.from(
                                authenticator.credentialPublicKey.buffer
                            ).toString("base64"),
                        };
                    } catch (e) {
                        log.warn("Failed to map interaction", e);
                    }
                    return { type: "login" };
                })
        );
    }
}
