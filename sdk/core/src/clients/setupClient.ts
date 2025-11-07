import { createIFrameFrakClient } from "../clients";
import type { FrakClient, FrakWalletSdkConfig } from "../types";
import { createIframe, getSupportedCurrency } from "../utils";

/**
 * Directly setup the Frak client with an iframe
 * Return when the FrakClient is ready (setup and communication estbalished with the wallet)
 *
 * @param config - The configuration to use for the Frak Wallet SDK
 * @returns a Promise with the Frak Client
 *
 * @example
 * const frakConfig: FrakWalletSdkConfig = {
 *     metadata: {
 *         name: "My app title",
 *     },
 * }
 * const client = await setupClient({ config: frakConfig });
 */
export async function setupClient({
    config,
}: {
    config: FrakWalletSdkConfig;
}): Promise<FrakClient | undefined> {
    // Prepare the config
    const preparedConfig = prepareConfig(config);

    // Create our iframe
    const iframe = await createIframe({
        config: preparedConfig,
    });

    if (!iframe) {
        console.error("Failed to create iframe");
        return;
    }

    // Create our client
    const client = createIFrameFrakClient({
        config: preparedConfig,
        iframe,
    });

    // Wait for the client to be all setup
    await client.waitForSetup;

    // Wait for the connection to be established
    const waitForConnection = await client.waitForConnection;
    if (!waitForConnection) {
        console.error("Failed to connect to client");
        return;
    }

    return client;
}

/**
 * Prepare the config for the Frak Client
 * @param config - The configuration to use for the Frak Wallet SDK
 * @returns The prepared configuration with the supported currency
 */
function prepareConfig(config: FrakWalletSdkConfig): FrakWalletSdkConfig {
    // Get the supported currency (e.g. "eur")
    const supportedCurrency = getSupportedCurrency(config.metadata?.currency);

    return {
        ...config,
        metadata: {
            ...config.metadata,
            currency: supportedCurrency,
        },
    };
}
