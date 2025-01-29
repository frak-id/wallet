import type { FrakClient, FullInteractionTypesKey } from "@frak-labs/core-sdk";
import {
    type ModalBuilder,
    getProductInformation,
    modalBuilder,
    referralInteraction,
} from "@frak-labs/core-sdk/actions";

const CUSTOM_EVENT_NAME = "frakClientReady";

let modalBuilderSteps: ModalBuilder | undefined;

export function dispatchClientReadyEvent() {
    const event = new CustomEvent(CUSTOM_EVENT_NAME);
    window.dispatchEvent(event);
}

/**
 * Add or remove an event listener for when the Frak client is ready
 * @param action
 * @param callback
 */
export function onClientReady(action: "add" | "remove", callback: () => void) {
    // Check if we already have a client, if yes, directly execute the callback
    if (window.FrakSetup?.client && action === "add") {
        callback();
        return;
    }
    // Add a listener for when the Frak client is ready
    const eventHandler =
        action === "add" ? window.addEventListener : window.removeEventListener;
    eventHandler(CUSTOM_EVENT_NAME, callback, false);
}

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

/**
 * Attempt to vibrate the device
 */
export function safeVibrate() {
    if ("vibrate" in navigator) {
        navigator.vibrate(200);
    } else {
        console.log("Vibration not supported");
    }
}

/**
 * Find the estimated reward
 * @param targetInteraction
 * @returns
 */
export async function getCurrentReward(
    targetInteraction?: FullInteractionTypesKey
) {
    // Get the client
    const client = window.FrakSetup?.client;
    if (!client) {
        console.warn("Frak client not ready yet");
        return;
    }

    const info = await getProductInformation(client);

    if (!info?.estimatedEurReward) return;

    let currentReward = info.estimatedEurReward;
    if (targetInteraction) {
        // Find the max reward for the target interaction
        const targetReward = info.rewards
            .filter((reward) => reward.interactionTypeKey === targetInteraction)
            .map((reward) => reward.referrer.eurAmount)
            .reduce((acc, reward) => (reward > acc ? reward : acc), 0);
        if (targetReward > 0) {
            currentReward = Math.ceil(targetReward).toString();
        }
    }

    return currentReward;
}
