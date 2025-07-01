import { setupClient } from "@frak-labs/core-sdk";
// @ts-ignore - Bundle module import
import * as coreSdk from "@frak-labs/core-sdk/bundle";
import { openWalletModal } from "../components/ButtonWallet/utils";
import { dispatchClientReadyEvent } from "./clientReady";
import { setupReferral } from "./setup";

/**
 * Initializes the Frak SDK client and sets up necessary configurations.
 * This function handles the one-time setup of the Frak client and related features.
 *
 * @returns {Promise<void>}
 */
export async function initFrakSdk(): Promise<void> {
    // Export Frak core sdk
    window.FrakSetup.core = coreSdk;

    // Pre-checks passed?
    if (!preChecks()) {
        return;
    }

    console.log("[Frak SDK] Starting initialization");

    // Set the setup flag
    window.frakSetupInProgress = true;

    if (!window.FrakSetup.config) {
        console.error("[Frak SDK] Configuration not found");
        window.frakSetupInProgress = false;
        return;
    }

    const client = await setupClient({
        config: window.FrakSetup.config,
    });

    if (!client) {
        console.error("[Frak SDK] Failed to create client");
        window.frakSetupInProgress = false;
        return;
    }

    // Set up global client instance
    window.FrakSetup.client = client;

    console.log("[Frak SDK] Client initialized successfully");

    // Dispatch the event to let the rest of the app know that the Frak client is ready
    dispatchClientReadyEvent();

    // Setup the referral
    setupReferral(client);

    // Reset the setup flag
    window.frakSetupInProgress = false;

    // Handle the action query param
    handleActionQueryParam();
}

/**
 * Pre-checks for the Frak SDK initialization
 */
function preChecks(): boolean {
    // Prevent multiple simultaneous initializations
    if (window.frakSetupInProgress) {
        console.log("[Frak SDK] Initialization already in progress");
        return false;
    }

    if (window.FrakSetup?.client) {
        // Prevent re-initialization if client exists
        console.log("[Frak SDK] Client already initialized");
        return false;
    }

    if (!window.FrakSetup?.config) {
        // Validate configuration
        console.error(
            "[Frak SDK] Configuration not found. Please ensure window.FrakSetup.config is set."
        );
        return false;
    }

    return true;
}

/**
 * Check the query param contain params for an auto opening of the frak modal
 */
function handleActionQueryParam() {
    const urlParams = new URLSearchParams(window.location.search);
    const frakAction = urlParams.get("frakAction");
    if (!frakAction) {
        return;
    }

    if (frakAction === "share") {
        console.log("[Frak SDK] Auto open query param found");
        openWalletModal();
    }
}
