import { setupClient } from "@frak-labs/core-sdk";
import { onDocumentReady } from "@shared/module/utils/onDocumentReady";
import { setupButtonShare } from "./ButtonShare";
import { setupButtonWallet } from "./ButtonWallet";
import { dispatchClientReadyEvent } from "./utils/clientReady";
import { setupModalConfig, setupReferral } from "./utils/setup";

setupButtonShare();
setupButtonWallet();

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
