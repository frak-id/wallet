import { generateSiweNonce } from "viem/siwe";
import type {
    NexusClient,
    SiweAuthenticateActionParamsType,
    SiweAuthenticateReturnType,
    SiweAuthenticationParams,
} from "../types";

/**
 * Function used to launch a siwe authentication
 * @param client
 * @param siwe
 * @param context
 */
export async function siweAuthenticate(
    client: NexusClient,
    { siwe, context }: SiweAuthenticateActionParamsType
): Promise<SiweAuthenticateReturnType> {
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

    return await client.request({
        method: "frak_siweAuthenticate",
        params: [builtSiwe, context],
    });
}
