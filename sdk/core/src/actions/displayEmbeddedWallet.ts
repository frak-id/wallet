import type {
    DisplayEmbeddedWalletParamsType,
    DisplayEmbeddedWalletResultType,
    FrakClient,
} from "../types";

/**
 * Function used to display the Frak embedded wallet popup
 * @param client - The current Frak Client
 * @param params - The parameter used to customise the embedded wallet
 */
export async function displayEmbeddedWallet(
    client: FrakClient,
    params: DisplayEmbeddedWalletParamsType
): Promise<DisplayEmbeddedWalletResultType> {
    return await client.request({
        method: "frak_displayEmbeddedWallet",
        params: [params, client.config.metadata],
    });
}
