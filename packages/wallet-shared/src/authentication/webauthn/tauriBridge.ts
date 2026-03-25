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
                    : null,
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
            console.warn("Tauri create error", e);
            throw new BaseError("Tauri create credential error", {
                cause: e instanceof Error ? e : new Error(String(e)),
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
            console.warn("Tauri get error", e);
            throw new BaseError("Tauri get credential error", {
                cause: e instanceof Error ? e : new Error(String(e)),
            });
        }
    };
}
