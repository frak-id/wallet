import { generateSiweNonce } from "viem/siwe";
import {
    FrakRpcError,
    type NexusClient,
    RpcErrorCodes,
    type SiweAuthenticateActionParamsType,
    type SiweAuthenticateReturnType,
    type SiweAuthenticationParams,
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
): Promise<Extract<SiweAuthenticateReturnType, { key: "success" }>> {
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

    const result = await client.request({
        method: "frak_siweAuthenticate",
        params: [builtSiwe, context],
    });

    switch (result.key) {
        case "aborted":
            throw new FrakRpcError(
                RpcErrorCodes.clientAborted,
                "The client has aborted the operation"
            );
        case "error":
            throw new FrakRpcError(
                RpcErrorCodes.serverError,
                result.reason ??
                    "An error occurred while performing the siwe authentication"
            );
        case "success":
            return result;
    }
}
