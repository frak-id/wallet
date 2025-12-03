import { isTauri } from "@frak-labs/app-essentials/utils/platform";
import { WebAuthnP256 } from "ox";

/**
 * Tauri plugin registration response from tauri-plugin-webauthn
 */
type TauriRegistrationResult = {
    id: string;
    rawId: string;
    response: {
        attestationObject: string;
        clientDataJSON: string;
        transports: string[];
    };
    type: string;
    extensions: Record<string, unknown>;
};

/**
 * Tauri plugin authentication response from tauri-plugin-webauthn
 */
type TauriAuthenticationResult = {
    id: string;
    rawId: string;
    response: {
        authenticatorData: string;
        clientDataJSON: string;
        signature: string;
        userHandle?: string;
    };
    type: string;
    extensions: Record<string, unknown>;
};

/**
 * Check if we're running on Android via Tauri
 */
function isAndroidTauri(): boolean {
    if (!isTauri()) return false;
    if (typeof window === "undefined") return false;
    // Android WebView uses tauri.localhost hostname
    return window.location.hostname === "tauri.localhost";
}

/**
 * Convert Uint8Array to base64url string (required by @simplewebauthn/types)
 */
function toBase64Url(bytes: Uint8Array): string {
    const base64 = btoa(String.fromCharCode(...bytes));
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Call Tauri plugin directly using invoke API
 */
async function invokeTauriPlugin<T>(
    command: string,
    args?: Record<string, unknown>
): Promise<T> {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke(`plugin:webauthn|${command}`, args);
}

/**
 * Platform-agnostic WebAuthn credential creation
 * Uses Tauri plugin on Android, ox WebAuthn on iOS/web
 */
export async function createCredential(options: {
    rp: { id: string; name: string };
    user: { name: string; displayName: string };
    timeout?: number;
    attestation?: "none" | "indirect" | "direct";
    authenticatorSelection?: {
        residentKey?: "required" | "preferred" | "discouraged";
        userVerification?: "required" | "preferred" | "discouraged";
    };
    excludeCredentialIds?: string[];
}) {
    console.log("[WebAuthn Adapter] createCredential called");
    console.log("[WebAuthn Adapter] Platform:", {
        isTauri: isTauri(),
        isAndroid: isAndroidTauri(),
    });

    if (isAndroidTauri()) {
        console.log("[WebAuthn Adapter] Using Tauri plugin for Android");

        // Generate random bytes and convert to base64url (required by @simplewebauthn/types)
        const challengeBytes = crypto.getRandomValues(new Uint8Array(32));
        const userIdBytes = crypto.getRandomValues(new Uint8Array(32));

        // Convert to Tauri plugin format (uses @simplewebauthn/types JSON format)
        // All binary data must be base64url-encoded strings
        const tauriOptions = {
            challenge: toBase64Url(challengeBytes),
            rp: options.rp,
            user: {
                id: toBase64Url(userIdBytes),
                name: options.user.name,
                displayName: options.user.displayName,
            },
            pubKeyCredParams: [
                { type: "public-key", alg: -7 }, // ES256
                { type: "public-key", alg: -257 }, // RS256
            ],
            timeout: options.timeout ?? 180000,
            attestation: options.attestation ?? "direct",
            authenticatorSelection: {
                requireResidentKey:
                    options.authenticatorSelection?.residentKey === "required",
                residentKey:
                    options.authenticatorSelection?.residentKey ?? "required",
                userVerification:
                    options.authenticatorSelection?.userVerification ??
                    "required",
                authenticatorAttachment: "platform",
            },
            excludeCredentials: options.excludeCredentialIds?.map((id) => ({
                type: "public-key" as const,
                id: toBase64Url(new TextEncoder().encode(id)),
            })),
        };

        console.log(
            "[WebAuthn Adapter] Tauri options:",
            JSON.stringify(tauriOptions, null, 2)
        );

        try {
            // Call Tauri plugin - parameters must match Rust function signature
            // Use dev domain for testing, production for release
            const origin = "https://wallet-dev.frak.id";
            const result = await invokeTauriPlugin<TauriRegistrationResult>(
                "register",
                {
                    origin,
                    options: tauriOptions,
                }
            );

            console.log(
                "[WebAuthn Adapter] Tauri registration result:",
                result
            );
            console.log(
                "[WebAuthn Adapter] Tauri result.response:",
                result.response
            );

            // Pass through the full Tauri result for Android
            // The useRegister hook will detect this format and handle accordingly
            return {
                id: result.id,
                publicKey: null, // Will be extracted by backend from attestation
                raw: result, // Full simplewebauthn format
                isAndroidTauri: true, // Flag to detect format
            };
        } catch (error) {
            console.error(
                "[WebAuthn Adapter] Tauri registration failed:",
                error
            );
            throw error;
        }
    }

    // iOS/Web: Use ox WebAuthn (existing code)
    console.log("[WebAuthn Adapter] Using ox WebAuthn for iOS/Web");
    return WebAuthnP256.createCredential(options);
}

/**
 * Platform-agnostic WebAuthn authentication
 * Uses Tauri plugin on Android, ox WebAuthn on iOS/web
 */
export async function sign(options: {
    credentialId?: string;
    rpId: string;
    challenge: `0x${string}`;
    userVerification?: "required" | "preferred" | "discouraged";
}) {
    console.log("[WebAuthn Adapter] sign called");
    console.log("[WebAuthn Adapter] Platform:", {
        isTauri: isTauri(),
        isAndroid: isAndroidTauri(),
    });

    if (isAndroidTauri()) {
        console.log("[WebAuthn Adapter] Using Tauri plugin for Android");

        // Convert hex challenge to bytes then to base64url
        const challengeHex = options.challenge.startsWith("0x")
            ? options.challenge.slice(2)
            : options.challenge;
        const challengeBytes = new Uint8Array(challengeHex.length / 2);
        for (let i = 0; i < challengeHex.length; i += 2) {
            challengeBytes[i / 2] = Number.parseInt(
                challengeHex.slice(i, i + 2),
                16
            );
        }

        // Convert to Tauri plugin format (uses @simplewebauthn/types JSON format)
        // Note: allowCredentials must always be an array (empty for discoverable credentials)
        const tauriOptions = {
            challenge: toBase64Url(challengeBytes),
            rpId: options.rpId,
            allowCredentials: options.credentialId
                ? [
                      {
                          type: "public-key" as const,
                          id: toBase64Url(
                              new TextEncoder().encode(options.credentialId)
                          ),
                      },
                  ]
                : [],
            userVerification: options.userVerification ?? "required",
            timeout: 180000,
        };

        console.log(
            "[WebAuthn Adapter] Tauri auth options:",
            JSON.stringify(tauriOptions, null, 2)
        );

        try {
            // Call Tauri plugin - parameters must match Rust function signature
            // Use dev domain for testing, production for release
            const origin = "https://wallet-dev.frak.id";
            const result = await invokeTauriPlugin<TauriAuthenticationResult>(
                "authenticate",
                {
                    origin,
                    options: tauriOptions,
                }
            );

            console.log(
                "[WebAuthn Adapter] Tauri authentication result:",
                result
            );
            console.log(
                "[WebAuthn Adapter] Tauri result.response:",
                result.response
            );

            // The Tauri plugin returns standard WebAuthn format
            // We need to pass the full result as 'raw' for backend parsing
            // The useLogin hook will construct the authenticationResponse from raw.id
            return {
                metadata: result.response,
                signature: result.response,
                raw: result,
            };
        } catch (error) {
            console.error(
                "[WebAuthn Adapter] Tauri authentication failed:",
                error
            );
            throw error;
        }
    }

    // iOS/Web: Use ox WebAuthn (existing code)
    console.log("[WebAuthn Adapter] Using ox WebAuthn for iOS/Web");
    return WebAuthnP256.sign(options);
}
