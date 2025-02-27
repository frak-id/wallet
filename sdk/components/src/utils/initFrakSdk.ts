import { setupClient } from "@frak-labs/core-sdk";
import { dispatchClientReadyEvent } from "./clientReady";
import { setupModalConfig, setupReferral } from "./setup";

export async function initFrakSdk() {
    if (!window.FrakSetup?.config) {
        console.error("window.FrakSetup.config not found");
        return;
    }

    if (window.FrakSetup.client) {
        console.log("Frak client already initialized");
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
}
