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
    const preparedConfig = prepareConfig(config);

    const iframe = await createIframe({
        config: preparedConfig,
    });

    if (!iframe) {
        console.error("Failed to create iframe");
        return;
    }

    const client = await createIFrameFrakClient({
        config: preparedConfig,
        iframe,
    });

    await client.waitForSetup;

    const waitForConnection = await client.waitForConnection;
    if (!waitForConnection) {
        console.error("Failed to connect to client");
        return;
    }

    return client;
}

/** Normalise the config currency to one the wallet supports. */
function prepareConfig(config: FrakWalletSdkConfig): FrakWalletSdkConfig {
    const supportedCurrency = getSupportedCurrency(config.metadata.currency);

    return {
        ...config,
        metadata: {
            ...config.metadata,
            currency: supportedCurrency,
        },
    };
}
