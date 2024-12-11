import {
    type ModalBuilder,
    modalBuilder,
    referralInteraction,
} from "@core/actions";
import type { NexusClient } from "@core/index";

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
    const eventHandler =
        action === "add" ? window.addEventListener : window.removeEventListener;
    eventHandler(CUSTOM_EVENT_NAME, callback, false);
}

/**
 * Setup the modal config
 * @param client
 */
export function setupModalConfig(client: NexusClient) {
    modalBuilderSteps = modalBuilder(
        client,
        window.FrakSetup?.modalConfig ?? {}
    );
}

/**
 * Setup the referral
 * @param client
 */
export async function setupReferral(client: NexusClient) {
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
