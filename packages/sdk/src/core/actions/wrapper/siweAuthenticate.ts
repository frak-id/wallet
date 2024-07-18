import { generateSiweNonce } from "viem/siwe";
import type {
    NexusClient,
    SiweAuthenticateReturnType,
    SiweAuthenticationParams,
} from "../../types";
import { displayModal } from "../displayModal";

/**
 * Partial SIWE params, since we can rebuild them from the SDK if they are empty
 */
export type SiweAuthenticateModalParams = {
    siwe?: Partial<SiweAuthenticationParams>;
    context?: string;
};

/**
 * Function used to launch a siwe authentication
 * @param client
 * @param siwe
 * @param context
 */
export async function siweAuthenticate(
    client: NexusClient,
    { siwe, context }: SiweAuthenticateModalParams
): Promise<SiweAuthenticateReturnType> {
    const realStatement =
        siwe?.statement ??
        `I confirm that I want to use my Nexus wallet on: ${client.config.metadata.name}`;

    // Fill up the siwe request params
    const builtSiwe: SiweAuthenticationParams = {
        ...siwe,
        statement: realStatement,
        nonce: siwe?.nonce ?? generateSiweNonce(),
        uri: siwe?.uri ?? `https://${client.config.domain}`,
        version: siwe?.version ?? "1",
        domain: client.config.domain,
    };

    // Trigger a modal with login options
    const result = await displayModal(client, {
        context,
        steps: {
            login: {},
            siweAuthenticate: {
                siwe: builtSiwe,
            },
        },
    });

    // Return the SIWE result only
    return result.siweAuthenticate;
}
