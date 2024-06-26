import { generateSiweNonce } from "viem/siwe";
import type {
    AuthenticateActionParamsType,
    NexusClient,
    SiweAuthenticationParams,
} from "../types";

/**
 * Function used to launch a siwe authentication
 * @param client
 * @param siwe
 * @param context
 */
export function siweAuthenticate(
    client: NexusClient,
    { siwe, context }: AuthenticateActionParamsType
) {
    const realStatement =
        siwe?.statement ??
        `I confirm that I want to use my Nexus wallet on: ${client.config.metadata.name}`;

    const builtSiwe: SiweAuthenticationParams = {
        ...siwe,
        statement: realStatement,
        nonce: siwe?.nonce ?? generateSiweNonce(),
        uri: siwe?.uri ?? `https://${client.config.domain}`,
        version: siwe?.version ?? "1",
        domain: client.config.domain,
    };

    return client.request({
        method: "frak_siweAuthenticate",
        params: [builtSiwe, context],
    });
}
