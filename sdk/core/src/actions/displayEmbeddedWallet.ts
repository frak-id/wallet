import type {
    DisplayEmbeddedWalletParamsType,
    DisplayEmbeddedWalletResultType,
    FrakClient,
} from "../types";

/**
 * Function used to display the Frak embedded wallet popup
 * @param client - The current Frak Client
 * @param params - The parameter used to customise the embedded wallet
 * @param placement - Optional placement ID to associate with this display request
 * @returns The embedded wallet display result
 */
export async function displayEmbeddedWallet(
    client: FrakClient,
    params: DisplayEmbeddedWalletParamsType,
    placement?: string
): Promise<DisplayEmbeddedWalletResultType> {
    return await client.request({
        method: "frak_displayEmbeddedWallet",
        params: placement
            ? [params, client.config.metadata, placement]
            : [params, client.config.metadata],
    });
}
