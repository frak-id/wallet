import { createIFrameNexusClient } from "../clients";
import type { NexusClient, NexusWalletSdkConfig } from "../types";
import { createIframe } from "./iframeHelper";

/**
 * Setup the Nexus client using the Nexus Wallet SDK
 * @param config
 */
export async function setupClient({
    config,
}: { config: NexusWalletSdkConfig }): Promise<NexusClient | undefined> {
    // Create our iframe
    const iframe = await createIframe({
        config,
    });

    if (!iframe) {
        console.error("Failed to create iframe");
        return;
    }

    // Create our client
    const client = createIFrameNexusClient({
        config,
        iframe,
    });

    // Wait for the connection to be established
    const waitForConnection = await client.waitForConnection;

    if (!waitForConnection) {
        console.error("Failed to connect to client");
        return;
    }

    return client;
}
