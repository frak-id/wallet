import type { NexusClient } from "../core";

const CUSTOM_EVENT_NAME = "frakClientReady";

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
 * Setup the Frak client using the Frak SDK
 */
export async function setupClient(): Promise<NexusClient | undefined> {
    if (!window?.FrakSetup.config) {
        console.error("window.FrakSetup.config not found");
        return;
    }

    // Create our iframe
    const iframe = await window.NexusSDK.createIframe({
        walletBaseUrl:
            window.FrakSetup.config.walletUrl ?? "https://wallet.frak.id",
    });

    if (!iframe) {
        console.error("Failed to create iframe");
        return;
    }

    // Create our client
    const client = window.NexusSDK.createIFrameNexusClient({
        config: window.FrakSetup.config,
        iframe,
    });

    // Wait for the connection to be established
    const waitForConnection = await client.waitForConnection;

    if (!waitForConnection) {
        console.error("Failed to connect to Frak client");
        return;
    }

    // Set the client on the window object to be available globally
    window.FrakSetup.client = client;

    // Dispatch the event to let the rest of the app know that the Frak client is ready
    dispatchClientReadyEvent();

    return client;
}

/**
 * Setup the modal config
 * @param client
 */
export function setupModalConfig(client: NexusClient) {
    if (!window.FrakSetup.modalConfig) {
        console.error("window.FrakSetup.modalConfig not found");
        return;
    }

    window.FrakSetup.modalBuilderSteps = window.NexusSDK.modalBuilder(
        client,
        window.FrakSetup.modalConfig
    );
}

/**
 * Setup the referral
 * @param client
 */
export async function setupReferral(client: NexusClient) {
    const referral = await window.NexusSDK.referralInteraction(client, {
        modalConfig: window.FrakSetup.modalBuilderSteps?.reward().params,
        options: {
            alwaysAppendUrl: true,
        },
    });
    console.log("referral", referral);
}

/**
 * When the document is ready, run the callback
 * @param callback
 */
export function onDocumentReady(callback: () => void) {
    if (
        document.readyState === "complete" ||
        document.readyState === "interactive"
    ) {
        setTimeout(callback, 1);
    } else if (document.addEventListener) {
        document.addEventListener("DOMContentLoaded", callback);
    } else {
        // @ts-ignore
        document.attachEvent("onreadystatechange", () => {
            if (document.readyState === "complete") {
                callback();
            }
        });
    }
}

/**
 * Load a script
 * @param id
 * @param url
 */
export async function loadScript(id: string, url: string) {
    if (document.getElementById(id)) {
        return Promise.resolve(true);
    }

    return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.id = id;
        script.src = url;
        script.async = true;
        script.onload = () => resolve(true);
        script.onerror = () =>
            reject(new Error(`Script load error for ${url}`));

        document.head.appendChild(script);
    });
}
