/**
 * Structured classification of native WebAuthn failures surfaced through the
 * `frak-webauthn` Tauri plugin (Android Credential Manager / iOS
 * ASAuthorization).
 *
 * Android collapses 50+ internal Google Play Services codes into a handful of
 * WebAuthn error types before they reach the app, but the raw message often
 * still carries a `[50xxx]` GPS code. The one that matters most for us is
 * **50162** ("Unsuccessful result from folsom activity." / "Can't find proper
 * key to decrypt the private key from WebauthnCredentialSpecifics") — a Google
 * Password Manager *sync* failure. It surfaces as `TYPE_NOT_ALLOWED_ERROR` on
 * `create()` and as the raw folsom message on `get()`. It is device/account
 * local, **not retryable**, and the remedy is on the user's GPM / Play Services
 * state — not our request or asset-links config.
 *
 * The classifier is pure + synchronous so it can run in the Tauri bridge, the
 * error UI and the analytics layer without side effects.
 *
 * @see https://www.corbado.com/blog/google-play-services-passkey-error-codes
 */

export type WebauthnErrorCode =
    | "passkey-sync-failed" // GPS 50162 — GPM "folsom" key/sync failure
    | "no-credential" // nothing available to authenticate with
    | "provider-unavailable" // no eligible credential provider configured
    | "unknown";

export type WebauthnErrorDetails = {
    code: WebauthnErrorCode;
    /** Whether replaying the same ceremony can plausibly succeed. */
    retryable: boolean;
    /** Parsed Google Play Services code, e.g. "50162". */
    gpsCode?: string;
    /** `androidx.credentials.TYPE_*` string, when present. */
    nativeType?: string;
    /** Native exception class name (CreatePublicKeyCredentialDomException, …). */
    exceptionClass?: string;
    /** Raw native message (may contain the `[50xxx]` prefix). */
    message: string;
};

/** Marker the Android plugin stamps on its structured reject payload. */
const PLUGIN_ERROR_SOURCE = "frak-webauthn-plugin";

type PluginErrorPayload = {
    source: string;
    exceptionClass?: string;
    type?: string;
    message?: string;
};

/**
 * Error carrying the structured native details. The Tauri bridge throws this
 * as the `cause` of the ox-wrapped failure so the UI and analytics can recover
 * the classification by walking the `cause` chain.
 */
export class CredentialManagerError extends Error {
    readonly __webauthnErrorDetails: WebauthnErrorDetails;

    constructor(details: WebauthnErrorDetails) {
        super(details.message || details.code);
        this.name = "CredentialManagerError";
        this.__webauthnErrorDetails = details;
    }
}

function hasDetails(
    value: unknown
): value is { __webauthnErrorDetails: WebauthnErrorDetails } {
    return (
        typeof value === "object" &&
        value !== null &&
        "__webauthnErrorDetails" in value &&
        typeof (value as Record<string, unknown>).__webauthnErrorDetails ===
            "object"
    );
}

/**
 * Parse the JSON payload the Android plugin sends on a structured reject.
 * Returns null for plain-string rejects (iOS cancellations, legacy messages).
 */
export function parsePluginErrorPayload(
    raw: string
): PluginErrorPayload | null {
    if (!raw.includes(PLUGIN_ERROR_SOURCE)) return null;
    try {
        const parsed = JSON.parse(raw) as PluginErrorPayload;
        return parsed?.source === PLUGIN_ERROR_SOURCE ? parsed : null;
    } catch {
        return null;
    }
}

const GPS_CODE_PATTERN = /\[(\d{5})\]/;

function parseGpsCode(message: string): string | undefined {
    return message.match(GPS_CODE_PATTERN)?.[1];
}

/**
 * Classify a raw native error message (optionally a structured plugin payload)
 * into an actionable code + telemetry fields.
 */
export function classifyNativeWebauthnError(raw: string): WebauthnErrorDetails {
    const payload = parsePluginErrorPayload(raw);
    const message = payload?.message ?? raw;
    const nativeType = payload?.type;
    const exceptionClass = payload?.exceptionClass;
    const gpsCode = parseGpsCode(message);
    const haystack = `${nativeType ?? ""} ${message}`.toLowerCase();

    // GPS 50162 — Google Password Manager "folsom" sync/decrypt failure.
    // Surfaces as the raw folsom message on get() and (often) as
    // TYPE_NOT_ALLOWED_ERROR with a [50162] message on create().
    if (gpsCode === "50162" || haystack.includes("folsom")) {
        return {
            code: "passkey-sync-failed",
            retryable: false,
            gpsCode: gpsCode ?? "50162",
            nativeType,
            exceptionClass,
            message,
        };
    }

    // No credential available to authenticate with.
    if (
        haystack.includes("type_no_credential") ||
        haystack.includes("no credential")
    ) {
        return {
            code: "no-credential",
            retryable: false,
            gpsCode,
            nativeType,
            exceptionClass,
            message,
        };
    }

    // No eligible credential provider (GPM disabled / none configured).
    if (
        haystack.includes("nocreateoption") ||
        haystack.includes("no create option") ||
        haystack.includes("type_no_create_option")
    ) {
        return {
            code: "provider-unavailable",
            retryable: false,
            gpsCode,
            nativeType,
            exceptionClass,
            message,
        };
    }

    return {
        code: "unknown",
        retryable: true,
        gpsCode,
        nativeType,
        exceptionClass,
        message,
    };
}

/**
 * Walk an error's `cause` chain to recover the structured details attached by
 * the Tauri bridge. Returns null for web / iOS / non-native errors so callers
 * can fall back to their own (cancellation, generic) handling.
 */
export function getWebauthnErrorDetails(
    error: unknown
): WebauthnErrorDetails | null {
    let current: unknown = error;
    for (let depth = 0; depth < 6 && current; depth++) {
        if (hasDetails(current)) return current.__webauthnErrorDetails;
        current = current instanceof Error ? current.cause : undefined;
    }
    return null;
}
