/**
 * Tauri WebAuthn Bridge
 *
 * Adapts the frak-webauthn Tauri plugin responses to Credential-like objects
 * that the `ox` WebAuthnP256 library expects.
 *
 * Both iOS (ASAuthorization) and Android (Credential Manager) return the same
 * JSON shape with base64url-encoded fields. This bridge decodes them to
 * ArrayBuffers and wraps in Credential-like objects.
 */

import { WebAuthN } from "@frak-labs/app-essentials";
import {
    isAndroid,
    isIOS,
    isTauri,
} from "@frak-labs/app-essentials/utils/platform";
import type { WebAuthnP256 } from "ox";
import { BaseError } from "ox/Errors";

// ============================================================================
// Types matching what the plugin returns (base64url JSON)
// ============================================================================

type PluginRegistrationResponse = {
    id: string;
    rawId: string;
    type: "public-key";
    response: {
        clientDataJSON: string;
        attestationObject: string;
        publicKey?: string;
        authenticatorData?: string;
        transports?: string[];
        publicKeyAlgorithm?: number;
    };
    authenticatorAttachment?: string | null;
    clientExtensionResults?: Record<string, unknown>;
};

type PluginAuthenticationResponse = {
    id: string;
    rawId: string;
    type: "public-key";
    response: {
        clientDataJSON: string;
        authenticatorData: string;
        signature: string;
        userHandle?: string;
    };
    authenticatorAttachment?: string | null;
    clientExtensionResults?: Record<string, unknown>;
};

type OxCreateFn = WebAuthnP256.createCredential.Options["createFn"];
type OxGetFn = WebAuthnP256.sign.Options["getFn"];

// ============================================================================
// Base64URL conversion utilities
// ============================================================================

export function toBase64Url(
    buffer: ArrayBuffer | ArrayBufferView | Uint8Array
): string {
    let bytes: Uint8Array;
    if (buffer instanceof Uint8Array) {
        bytes = buffer;
    } else if (buffer instanceof ArrayBuffer) {
        bytes = new Uint8Array(buffer);
    } else {
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

export function fromBase64Url(base64url: string): ArrayBuffer {
    const padded = base64url + "=".repeat((4 - (base64url.length % 4)) % 4);
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

async function invokeTauriPlugin<T>(
    command: string,
    args?: Record<string, unknown>
): Promise<T> {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke(`plugin:frak-webauthn|${command}`, args);
}

function getWebAuthnOrigin(): string {
    if (isAndroid()) return WebAuthN.androidApkOrigin;
    if (isIOS()) return WebAuthN.rpOrigin;
    return WebAuthN.rpOrigin;
}

// ============================================================================
// SPKI DER extraction from attestationObject (iOS fallback)
//
// iOS ASAuthorization doesn't expose the public key in SPKI DER format.
// We extract P-256 coordinates from the COSE key embedded in the
// attestationObject using the same byte-scan approach as Ox's internal
// fallback (ox/core/internal/webauthn.ts).
//
// CBOR encoding reference:
//   0x21 = CBOR negative int -2 (COSE label for x coordinate)
//   0x22 = CBOR negative int -3 (COSE label for y coordinate)
//   0x58 = CBOR byte string with 1-byte length prefix
//   0x20 = 32 (coordinate byte length for P-256)
// ============================================================================

const P256_COORDINATE_LENGTH = 0x20;
const CBOR_BSTR_1BYTE_LEN = 0x58;
const COSE_X_LABEL = 0x21;
const COSE_Y_LABEL = 0x22;

const SPKI_P256_HEADER = new Uint8Array([
    0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02,
    0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03,
    0x42, 0x00,
]);

function findCoseCoordinate(
    data: Uint8Array,
    label: number
): Uint8Array | null {
    const needle = [label, CBOR_BSTR_1BYTE_LEN, P256_COORDINATE_LENGTH];
    for (let i = 0; i <= data.length - 3 - P256_COORDINATE_LENGTH; i++) {
        if (
            data[i] === needle[0] &&
            data[i + 1] === needle[1] &&
            data[i + 2] === needle[2]
        ) {
            return data.slice(i + 3, i + 3 + P256_COORDINATE_LENGTH);
        }
    }
    return null;
}

function extractSpkiFromAttestation(
    attestationObjectB64: string
): ArrayBuffer | null {
    const data = new Uint8Array(fromBase64Url(attestationObjectB64));
    const x = findCoseCoordinate(data, COSE_X_LABEL);
    const y = findCoseCoordinate(data, COSE_Y_LABEL);
    if (!x || !y) return null;

    const spki = new Uint8Array(
        SPKI_P256_HEADER.length + 1 + P256_COORDINATE_LENGTH * 2
    );
    spki.set(SPKI_P256_HEADER);
    spki[SPKI_P256_HEADER.length] = 0x04;
    spki.set(x, SPKI_P256_HEADER.length + 1);
    spki.set(y, SPKI_P256_HEADER.length + 1 + P256_COORDINATE_LENGTH);
    return spki.buffer;
}

// ============================================================================
// Tauri error handling
// ============================================================================

function extractTauriErrorMessage(e: unknown): string {
    if (e instanceof Error) return e.message;
    if (typeof e === "object" && e !== null && "message" in e) {
        return String((e as { message: unknown }).message);
    }
    return String(e);
}

function tauriErrorToCause(e: unknown): Error {
    if (e instanceof Error) return e;
    return new Error(extractTauriErrorMessage(e));
}

/**
 * Detect user cancellation from native platforms.
 *  - iOS: ASAuthorizationError.canceled → "NotAllowedError" or "error 1001"
 *  - Android: CreateCredentialCancellationException → "NotAllowedError"
 *  - Android (legacy/localized): message contains "cancel"
 */
function isTauriCancellation(e: unknown): boolean {
    const msg = extractTauriErrorMessage(e).toLowerCase();
    return (
        msg.includes("notallowederror") ||
        msg.includes("error 1001") ||
        msg.includes("cancel")
    );
}

// ============================================================================
// Credential Creation (Registration)
// ============================================================================

function toPluginCreationOptions(
    publicKey: NonNullable<CredentialCreationOptions["publicKey"]>
): Record<string, unknown> {
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
                  residentKey:
                      publicKey.authenticatorSelection.residentKey ??
                      "preferred",
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

function fromPluginRegistration(json: PluginRegistrationResponse) {
    return {
        id: json.id,
        type: "public-key" as const,
        rawId: fromBase64Url(json.rawId),
        response: {
            clientDataJSON: fromBase64Url(json.response.clientDataJSON),
            attestationObject: fromBase64Url(json.response.attestationObject),
            getPublicKey: (): ArrayBuffer | null =>
                json.response.publicKey
                    ? fromBase64Url(json.response.publicKey)
                    : extractSpkiFromAttestation(
                          json.response.attestationObject
                      ),
            getAuthenticatorData: (): ArrayBuffer =>
                json.response.authenticatorData
                    ? fromBase64Url(json.response.authenticatorData)
                    : new ArrayBuffer(0),
            getTransports: (): string[] => json.response.transports ?? [],
            getPublicKeyAlgorithm: (): number =>
                json.response.publicKeyAlgorithm ?? -7,
        },
        authenticatorAttachment: json.authenticatorAttachment ?? null,
        getClientExtensionResults: () => json.clientExtensionResults ?? {},
        toJSON: () => json,
    };
}

export function getTauriCreateFn(): OxCreateFn {
    if (!isTauri()) return undefined;

    return async (options) => {
        if (!options?.publicKey) return null;

        const pluginOptions = toPluginCreationOptions(options.publicKey);
        const origin = getWebAuthnOrigin();

        try {
            const response =
                await invokeTauriPlugin<PluginRegistrationResponse>(
                    "register",
                    { origin, options: pluginOptions }
                );
            return fromPluginRegistration(response);
        } catch (e) {
            if (isTauriCancellation(e)) {
                const err = new Error("User cancelled the operation");
                err.name = "NotAllowedError";
                throw err;
            }

            console.warn("Tauri create error", e);
            throw new BaseError("Tauri create credential error", {
                cause: tauriErrorToCause(e),
            });
        }
    };
}

// ============================================================================
// Credential Request (Authentication / Signing)
// ============================================================================

function toPluginRequestOptions(
    publicKey: NonNullable<CredentialRequestOptions["publicKey"]>
): Record<string, unknown> {
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

function fromPluginAuthentication(json: PluginAuthenticationResponse) {
    return {
        id: json.id,
        type: "public-key",
        rawId: fromBase64Url(json.rawId),
        response: {
            clientDataJSON: fromBase64Url(json.response.clientDataJSON),
            authenticatorData: fromBase64Url(json.response.authenticatorData),
            signature: fromBase64Url(json.response.signature),
            userHandle: json.response.userHandle
                ? fromBase64Url(json.response.userHandle)
                : null,
        },
        authenticatorAttachment: json.authenticatorAttachment ?? null,
        getClientExtensionResults: () => json.clientExtensionResults ?? {},
        toJSON: () => json,
    };
}

export function getTauriGetFn(): OxGetFn {
    if (!isTauri()) return undefined;

    return async (options) => {
        if (!options?.publicKey) return null;

        const pluginOptions = toPluginRequestOptions(options.publicKey);
        const origin = getWebAuthnOrigin();

        try {
            const response =
                await invokeTauriPlugin<PluginAuthenticationResponse>(
                    "authenticate",
                    { origin, options: pluginOptions }
                );
            return fromPluginAuthentication(response) as Awaited<
                ReturnType<NonNullable<OxGetFn>>
            >;
        } catch (e) {
            if (isTauriCancellation(e)) {
                const err = new Error("User cancelled the operation");
                err.name = "NotAllowedError";
                throw err;
            }

            console.warn("Tauri get error", e);
            throw new BaseError("Tauri get credential error", {
                cause: tauriErrorToCause(e),
            });
        }
    };
}
