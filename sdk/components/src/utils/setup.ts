import type { FrakClient } from "@frak-labs/core-sdk";
import {
    type ModalBuilder,
    modalBuilder,
    referralInteraction,
} from "@frak-labs/core-sdk/actions";

let modalBuilderSteps: ModalBuilder | undefined;

/**
 * Setup the modal config
 * @param client
 */
export function setupModalConfig(client: FrakClient) {
    modalBuilderSteps = modalBuilder(
        client,
        window.FrakSetup?.modalConfig ?? {}
    );
}

/**
 * Setup the referral
 * @param client
 */
export async function setupReferral(client: FrakClient) {
    if (!modalBuilderSteps) {
        console.error("modalBuilderSteps not found");
        return;
    }

    const referral = await referralInteraction(client, {
        modalConfig: modalBuilderSteps.reward().params,
    });
    console.log("referral", referral);
}

/**
 * Return the modal builder steps
 */
export function getModalBuilderSteps() {
    return modalBuilderSteps;
}
