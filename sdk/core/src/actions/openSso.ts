import type { FrakClient, OpenSsoParamsType } from "../types";

/**
 * Function used to open the SSO
 * @param client
 * @param args
 */
export async function openSso(
    client: FrakClient,
    args: OpenSsoParamsType
): Promise<void> {
    const { metadata } = client.config;
    await client.request({
        method: "frak_sso",
        params: [args, metadata.name, metadata.css],
    });
}
