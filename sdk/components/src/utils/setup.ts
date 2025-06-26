import type { FrakClient } from "@frak-labs/core-sdk";
import type { ModalBuilder } from "@frak-labs/core-sdk/actions";

/**
 * Setup the modal config
 * @param client
 */
export function setupModalConfig(client: FrakClient) {
    window.modalBuilderSteps = window.FrakSDK.actions.modalBuilder(
        client,
        window.FrakSetup?.modalConfig ?? {}
    );
}

/**
 * Setup the referral
 * @param client
 */
export async function setupReferral(client: FrakClient) {
    const referral = await window.FrakSDK.actions.referralInteraction(client, {
        modalConfig: window.FrakSetup?.modalWalletConfig,
    });
    console.log("referral", referral);
}

/**
 * Return the modal builder steps
 */
export function getModalBuilderSteps(): ModalBuilder {
    if (!window.modalBuilderSteps) {
        throw new Error("modalBuilderSteps not found");
    }

    return window.modalBuilderSteps;
}
