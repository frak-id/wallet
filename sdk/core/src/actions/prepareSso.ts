import type {
    FrakClient,
    PrepareSsoParamsType,
    PrepareSsoReturnType,
} from "../types";

// SSO popup configuration
export const ssoPopupFeatures =
    "menubar=no,status=no,scrollbars=no,fullscreen=no,width=500, height=800";
export const ssoPopupName = "frak-sso";

/**
 * Function used to prepare the SSO URL for popup flow
 * @param client - The current Frak Client
 * @param args - The SSO parameters
 */
export async function prepareSso(
    client: FrakClient,
    args: PrepareSsoParamsType
): Promise<PrepareSsoReturnType> {
    const { metadata, customizations } = client.config;

    return await client.request({
        method: "frak_prepareSso",
        params: [args, metadata.name, customizations?.css],
    });
}
