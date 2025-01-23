import type { DisplayEmbededWalletParamsType, FrakClient } from "../types";

/**
 * Function used to display the Frak embeded wallet popup
 * @param client - The current Frak Client
 * @param params - The parameter used to customise the embeded wallet
 */
export async function displayEmbededWallet(
    client: FrakClient,
    params: DisplayEmbededWalletParamsType
): Promise<void> {
    await client.request({
        method: "frak_displayEmbededWallet",
        params: [params],
    });
}
