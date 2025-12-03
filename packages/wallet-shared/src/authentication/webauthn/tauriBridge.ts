/**
 * Tauri WebAuthn Bridge
 *
 * This module provides adapter functions that allow the `ox` WebAuthnP256 library
 * to work with the Tauri WebAuthn plugin on mobile platforms.
 *
 * The approach is simple:
 * 1. ox calls our custom createFn/getFn with standard CredentialCreationOptions/CredentialRequestOptions
 * 2. We convert these to the simplewebauthn JSON format that the Tauri plugin expects
 * 3. We call the Tauri plugin
 * 4. We convert the JSON response back to a native Credential-like object that ox can process
 *
 * This keeps the backend unchanged (always receives ox format) and minimizes frontend complexity.
 */

import { WebAuthN } from "@frak-labs/app-essentials";
import { isTauri } from "@frak-labs/app-essentials/utils/platform";
import type {
    PublicKeyCredentialCreationOptionsJSON,
    PublicKeyCredentialJSON,
    PublicKeyCredentialRequestOptionsJSON,
    RegistrationResponseJSON,
} from "@simplewebauthn/types";
import type { WebAuthnP256 } from "ox";
import { BaseError } from "ox/Errors";

// ============================================================================
// Extract ox's internal types to ensure compatibility
// ============================================================================

// Extract the createFn/getFn types from ox options
type OxCreateFn = WebAuthnP256.createCredential.Options["createFn"];
type OxGetFn = WebAuthnP256.sign.Options["getFn"];

// ============================================================================
// Base64URL conversion utilities
// ============================================================================

/**
 * Convert ArrayBuffer/Uint8Array to base64url string
 */
export function toBase64Url(
    buffer: ArrayBuffer | ArrayBufferView | Uint8Array
): string {
    let bytes: Uint8Array;
    if (buffer instanceof Uint8Array) {
        bytes = buffer;
    } else if (buffer instanceof ArrayBuffer) {
        bytes = new Uint8Array(buffer);
    } else {
        // ArrayBufferView
        bytes = new Uint8Array(
            buffer.buffer,
            buffer.byteOffset,
            buffer.byteLength
        );
    }
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

/**
 * Convert base64url string to ArrayBuffer
 */
export function fromBase64Url(base64url: string): ArrayBuffer {
    // Add padding if needed
    const padded = base64url + "=".repeat((4 - (base64url.length % 4)) % 4);
    // Replace URL-safe chars
    const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

// ============================================================================
// Tauri plugin invocation
// ============================================================================

/**
 * Dynamically import and invoke Tauri plugin
 */
async function invokeTauriPlugin<T>(
    command: string,
    args?: Record<string, unknown>
): Promise<T> {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke(`plugin:webauthn|${command}`, args);
}

// ============================================================================
// Credential Creation (Registration)
// ============================================================================

/**
 * Convert CredentialCreationOptions to Tauri plugin JSON format
 * Using `unknown` for buffer types to avoid type conflicts between ox and DOM types
 */
function toTauriCreationOptions({
    publicKey,
}: ReturnType<typeof WebAuthnP256.getCredentialCreationOptions>):
    | PublicKeyCredentialCreationOptionsJSON
    | undefined {
    if (!publicKey) return undefined;

    return {
        challenge: toBase64Url(publicKey.challenge as ArrayBuffer | Uint8Array),
        rp: publicKey.rp,
        user: {
            id: toBase64Url(publicKey.user?.id as ArrayBuffer | Uint8Array),
            name: publicKey.user?.name,
            displayName: publicKey.user?.displayName,
        },
        pubKeyCredParams: publicKey.pubKeyCredParams?.map((param) => ({
            type: param.type,
            alg: param.alg,
        })),
        timeout: publicKey.timeout,
        attestation: publicKey.attestation ?? "none",
        authenticatorSelection: publicKey.authenticatorSelection
            ? {
                  authenticatorAttachment:
                      publicKey.authenticatorSelection.authenticatorAttachment,
                  residentKey: publicKey.authenticatorSelection.residentKey,
                  requireResidentKey:
                      publicKey.authenticatorSelection.requireResidentKey,
                  userVerification:
                      publicKey.authenticatorSelection.userVerification,
              }
            : undefined,
        excludeCredentials: publicKey.excludeCredentials?.map((cred) => ({
            type: cred.type,
            id: toBase64Url(cred.id as ArrayBuffer | Uint8Array),
            transports: cred.transports,
        })),
        extensions: publicKey.extensions,
    };
}

/**
 * Convert Tauri plugin registration response to native Credential-like object
 * This object mimics the structure that ox expects from navigator.credentials.create()
 */
function fromTauriRegistrationResponse(
    json: RegistrationResponseJSON
): Awaited<ReturnType<NonNullable<OxCreateFn>>> {
    const attestationObject = fromBase64Url(json.response.attestationObject);
    const clientDataJSON = fromBase64Url(json.response.clientDataJSON);

    // Build the response object with methods that ox calls
    const response = {
        clientDataJSON,
        attestationObject,
        // ox calls getPublicKey() to extract the public key
        getPublicKey: (): ArrayBuffer | null => {
            // todo: android doesn't send back the publicKey here, need to extract it from the attestationObject
            if (json.response.publicKey) {
                return fromBase64Url(json.response.publicKey);
            }
            // If not provided, ox will fall back to parsing attestationObject
            return null;
        },
        getAuthenticatorData: (): ArrayBuffer => {
            if (json.response.authenticatorData) {
                return fromBase64Url(json.response.authenticatorData);
            }
            return new ArrayBuffer(0);
        },
        getTransports: (): string[] => {
            return json.response.transports ?? [];
        },
        getPublicKeyAlgorithm: (): number => {
            return json.response.publicKeyAlgorithm ?? -7; // ES256
        },
    };

    // Return a Credential-like object
    return {
        id: json.id,
        type: "public-key",
        rawId: fromBase64Url(json.rawId),
        response,
        authenticatorAttachment: json.authenticatorAttachment ?? null,
        getClientExtensionResults: () => json.clientExtensionResults ?? {},
    };
}

/**
 * Get a custom createFn for ox that uses the Tauri WebAuthn plugin
 * Returns undefined if not running in Tauri (ox will use default browser API)
 */
export function getTauriCreateFn(): OxCreateFn {
    console.log("Getting tauri create options");
    if (!isTauri()) {
        return undefined;
    }

    return async (options) => {
        console.log("Initial options", options);
        if (!options) return null;

        const tauriOptions = toTauriCreationOptions(options);
        if (!tauriOptions) return null;

        const origin = WebAuthN.rpOrigin;

        try {
            const response = await invokeTauriPlugin<RegistrationResponseJSON>(
                "register",
                {
                    origin,
                    options: tauriOptions,
                }
            );
            console.log("Tauri response", response)

            return fromTauriRegistrationResponse(response);
        } catch (e) {
            console.warn("Tauri create error", e);
            throw new BaseError("Tauri create credential error", {
                cause: e as Error,
            });
        }
    };
}

// ============================================================================
// Credential Request (Authentication / Signing)
// ============================================================================

/**
 * Convert CredentialRequestOptions to Tauri plugin JSON format
 * Using `unknown` for buffer types to avoid type conflicts between ox and DOM types
 */
function toTauriRequestOptions({
    publicKey,
}: ReturnType<typeof WebAuthnP256.getCredentialRequestOptions>):
    | PublicKeyCredentialRequestOptionsJSON
    | undefined {
    if (!publicKey) return undefined;
    return {
        challenge: toBase64Url(publicKey.challenge as ArrayBuffer | Uint8Array),
        rpId: publicKey.rpId,
        timeout: publicKey.timeout,
        userVerification: publicKey.userVerification ?? "required",
        allowCredentials:
            publicKey.allowCredentials?.map((cred) => ({
                type: cred.type,
                id: toBase64Url(cred.id as ArrayBuffer | Uint8Array),
                transports: cred.transports,
            })) ?? [],
        extensions: publicKey.extensions,
    };
}

/**
 * Convert Tauri plugin authentication response to native Credential-like object
 * This object mimics the structure that ox expects from navigator.credentials.get()
 */
function fromTauriAuthenticationResponse(json: PublicKeyCredentialJSON) {
    const authenticatorData = fromBase64Url(
        json.response.authenticatorData ?? ""
    );
    const clientDataJSON = fromBase64Url(json.response.clientDataJSON);
    const signature = fromBase64Url(
        "signature" in json.response ? (json.response.signature ?? "") : ""
    );

    // Build the response object
    const response = {
        clientDataJSON,
        authenticatorData,
        signature,
        userHandle:
            "userHandle" in json.response && json.response.userHandle
                ? fromBase64Url(json.response.userHandle)
                : null,
    };

    // Return a Credential-like object
    return {
        id: json.id,
        type: "public-key",
        rawId: fromBase64Url(json.rawId),
        response,
        authenticatorAttachment: json.authenticatorAttachment ?? null,
        getClientExtensionResults: () => json.clientExtensionResults ?? {},
    };
}

/**
 * Get a custom getFn for ox that uses the Tauri WebAuthn plugin
 * Returns undefined if not running in Tauri (ox will use default browser API)
 */
export function getTauriGetFn(): OxGetFn {
    if (!isTauri()) {
        return undefined;
    }

    return async (options) => {
        if (!options) return null;
        const tauriOptions = toTauriRequestOptions(options);
        if (!tauriOptions) return null;

        const origin = WebAuthN.rpOrigin;
        try {
            const response = await invokeTauriPlugin<PublicKeyCredentialJSON>(
                "authenticate",
                {
                    origin,
                    options: tauriOptions,
                }
            );
            console.log("Tauri response", response);

            return fromTauriAuthenticationResponse(response) as Awaited<
                ReturnType<NonNullable<OxGetFn>>
            >;
        } catch (e) {
            console.warn("Tauri get error", e);
            throw new BaseError("Tauri get credential error", {
                cause: e as Error,
            });
        }
    };
}
