import type {
    FrakClient,
    ModalRpcMetadata,
    SiweAuthenticateReturnType,
    SiweAuthenticationParams,
} from "../../types";
import { displayModal } from "../displayModal";

/**
 * Generate a random EIP-4361-compatible nonce.
 *
 * Matches viem/siwe's `generateSiweNonce` shape (96 alphanumeric chars) but
 * inlined here to avoid pulling viem's runtime utilities into the bundle.
 * Uses `crypto.getRandomValues` when available (browsers, modern Node) and
 * falls back to `Math.random` for the rare environment without WebCrypto.
 */
function generateSiweNonce(length = 96): string {
    const byteCount = Math.ceil(length / 2);
    let hex = "";
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
        const bytes = new Uint8Array(byteCount);
        crypto.getRandomValues(bytes);
        for (let i = 0; i < bytes.length; i++) {
            hex += bytes[i].toString(16).padStart(2, "0");
        }
    } else {
        for (let i = 0; i < byteCount; i++) {
            hex += ((Math.random() * 256) | 0).toString(16).padStart(2, "0");
        }
    }
    return hex.substring(0, length);
}

/**
 * Parameter used to directly show a modal used to authenticate with SIWE
 * @inline
 */
export type SiweAuthenticateModalParams = {
    /**
     * Partial SIWE params, since we can rebuild them from the SDK if they are empty
     *
     * If no parameters provider, some fields will be recomputed from the current configuration and environment.
     *  - `statement` will be set to a default value
     *  - `nonce` will be generated
     *  - `uri` will be set to the current domain
     *  - `version` will be set to "1"
     *  - `domain` will be set to the current window domain
     *
     * @default {}
     */
    siwe?: Partial<SiweAuthenticationParams>;
    /**
     * Custom metadata to be passed to the modal
     */
    metadata?: ModalRpcMetadata;
};

/**
 * Function used to launch a siwe authentication
 * @param client - The current Frak Client
 * @param args - The parameters
 * @returns The SIWE authentication result (message + signature) in a promise
 *
 * @description This function will display a modal to the user with the provided SIWE parameters and metadata.
 *
 * @example
 * import { siweAuthenticate } from "@frak-labs/core-sdk/actions";
 * import { parseSiweMessage } from "viem/siwe";
 *
 * const { signature, message } = await siweAuthenticate(frakConfig, {
 *     siwe: {
 *         statement: "Sign in to My App",
 *         domain: "my-app.com",
 *         expirationTimeTimestamp: Date.now() + 1000 * 60 * 5,
 *     },
 *     metadata: {
 *         header: {
 *             title: "Sign in",
 *         },
 *         context: "Sign in to My App",
 *     },
 * });
 * console.log("Parsed final message:", parseSiweMessage(message));
 * console.log("Siwe signature:", signature);
 */
export async function siweAuthenticate(
    client: FrakClient,
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
