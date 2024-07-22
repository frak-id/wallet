import type { NexusClient, OpenSsoParamsType } from "../types";

/**
 * Function used to open the SSO
 *  todo: We are using the iframe here, since we need to send potentially load of datas, and it couldn't fit inside the query params of an url
 * @param client
 * @param args
 */
export async function openSso(
    client: NexusClient,
    args: OpenSsoParamsType
): Promise<void> {
    const { metadata } = client.config;
    await client.request({
        method: "frak_sso",
        params: [args, metadata.name, metadata.css],
    });
}
