import { generateSiweNonce } from "viem/siwe";
import type {
    ModalRpcMetadata,
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
    metadata?: ModalRpcMetadata;
};

/**
 * Function used to launch a siwe authentication
 * @param client
 * @param siwe
 * @param context
 */
export async function siweAuthenticate(
    client: NexusClient,
    { siwe, metadata }: SiweAuthenticateModalParams
): Promise<SiweAuthenticateReturnType> {
    const effectiveDomain = client.config?.domain ?? window.location.host;
    const realStatement =
        siwe?.statement ??
        `I confirm that I want to use my Frak wallet on: ${client.config.metadata.name}`;

    // Fill up the siwe request params
    const builtSiwe: SiweAuthenticationParams = {
        ...siwe,
        statement: realStatement,
        nonce: siwe?.nonce ?? generateSiweNonce(),
        uri: siwe?.uri ?? `https://${effectiveDomain}`,
        version: siwe?.version ?? "1",
        domain: effectiveDomain,
    };

    // Trigger a modal with login options
    const result = await displayModal(client, {
        metadata,
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
