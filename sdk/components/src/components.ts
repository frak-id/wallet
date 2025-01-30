import { setupClient } from "@frak-labs/core-sdk";
import { onDocumentReady } from "@module/utils/onDocumentReady";
import {
    dispatchClientReadyEvent,
    setupModalConfig,
    setupReferral,
} from "./utils";

export { ButtonShare } from "./ButtonShare";
export { ButtonWallet } from "./ButtonWallet";

/**
 * Initialize the app on document ready
 */
onDocumentReady(async function init() {
    if (!window.FrakSetup?.config) {
        console.error("window.FrakSetup.config not found");
        return;
    }

    const client = await setupClient({ config: window.FrakSetup.config });

    if (!client) {
        console.error("Failed to create Frak client");
        return;
    }

    // Set the client on the window object to be available globally
    window.FrakSetup.client = client;

    // Dispatch the event to let the rest of the app know that the Frak client is ready
    dispatchClientReadyEvent();

    // Setup the modal config
    setupModalConfig(client);

    // Setup the referral
    setupReferral(client);
});
