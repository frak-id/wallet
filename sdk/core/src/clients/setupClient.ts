import { createIFrameFrakClient } from "../clients";
import { loadCachedConfig } from "../config/loadCachedConfig";
import type { FrakClient, FrakWalletSdkConfig } from "../types";
import { createIframe, getSupportedCurrency } from "../utils";

/**
 * Directly setup the Frak client with an iframe
 * Return when the FrakClient is ready (setup and communication estbalished with the wallet)
 *
 * @param config - The configuration to use for the Frak Wallet SDK
 * @returns a Promise with the Frak Client, or `undefined` if the wallet iframe has not connected after the 30 s handshake deadline (the client is then detached and the hidden iframe stays on the page)
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

    // Return visits paint the merchant's cached settings now, not after the iframe loads.
    loadCachedConfig(preparedConfig);

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

    if (!(await client.waitForConnection)) {
        console.error("Failed to connect to client");
        await client.destroy({ detachOnly: true });
        return;
    }

    await client.waitForSetup;

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
