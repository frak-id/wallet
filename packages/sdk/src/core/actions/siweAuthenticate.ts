import { generateSiweNonce } from "viem/siwe";
import type { AuthenticateActionParamsType, NexusClient } from "../types";

/**
 * Function used to launch a siwe authentication
 * @param client
 * @param nonce
 * @param statement
 * @param requestId
 * @param context
 *
 */
export function siweAuthenticate(
    client: NexusClient,
    { nonce, statement, requestId, context }: AuthenticateActionParamsType
) {
    const realStatement =
        statement ??
        `I confirm that I want to use my Nexus wallet on: ${client.config.metadata.name}`;

    return client.request({
        method: "frak_siweAuthenticate",
        params: [
            nonce ?? generateSiweNonce(),
            realStatement,
            client.config.domain,
            requestId,
            context,
        ],
    });
}
