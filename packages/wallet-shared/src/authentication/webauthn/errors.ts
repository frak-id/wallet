/**
 * Cross-platform WebAuthn failure classification.
 *
 * One taxonomy keyed on the WebAuthn DOMException name + Google Play Services
 * `[50xxx]` code — the locale-stable signals shared by all three surfaces:
 *  - Web: ox surfaces the raw DOMException (`.name`) as the failure `cause`.
 *  - iOS: the native plugin rejects a `{ type, message }` envelope where `type`
 *    is the DOMException name mapped from the ASAuthorizationError code.
 *  - Android: GPS collapses ~50 internal codes onto the same enum. On the legacy
 *    FIDO2 path the message keeps the numeric `[50xxx]` prefix (e.g. 50162 =
 *    Google Password Manager "folsom" sync/decrypt failure); on the Credential
 *    Manager path that prefix is STRIPPED for 5xxxx codes, so the only signals
 *    left are the `TYPE_*` enum token and the (mostly non-localized) message.
 *
 * Prose is a fallback signal — some native messages are localized, but the GPS
 * internal strings we match (folsom/decrypt) and the `TYPE_*` enum tokens are not.
 *
 * @see https://www.corbado.com/blog/google-play-services-passkey-error-codes
 * @see https://www.corbado.com/blog/native-app-passkey-errors
 * @see https://www.corbado.com/blog/webauthn-errors
 */

export type WebauthnErrorKind =
    | "cancelled" // user dismissed / timed out — soft, retryable
    | "sync-failed" // GPM "folsom" sync/decrypt failure (50162/50161/50191)
    | "no-screen-lock" // device has no PIN/biometric lock (50166 / ConstraintError)
    | "already-registered" // excludeCredentials match (InvalidStateError / 50157)
    | "no-credential" // nothing on this device to authenticate with (50156)
    | "unsupported" // platform/provider can't satisfy the request
    | "security" // origin / RP-ID / assetlinks misconfiguration (our bug)
    | "unknown";

export type WebauthnError = {
    kind: WebauthnErrorKind;
    /** Whether replaying the same ceremony can plausibly succeed. */
    retryable: boolean;
    /** Resolved WebAuthn DOMException name, when identifiable. */
    name?: string;
    /** Google Play Services code, e.g. "50162". */
    gpsCode?: string;
    /** Deepest native/DOM message (may carry the `[50xxx]` prefix + TYPE_ token). */
    message: string;
};

/** Kinds worth a Crashlytics non-fatal — developer-actionable, not user/env noise. */
const REPORTABLE_KINDS = new Set<WebauthnErrorKind>([
    "unsupported",
    "security",
    "unknown",
]);

const GPS_CODE_PATTERN = /\[(\d{5})\]/;

/**
 * Resolve a WebAuthn DOMException name from a haystack containing any of: a web
 * `error.name`, an iOS bare-string reject, or an Android `androidx.credentials.
 * TYPE_*` enum token. All locale-stable.
 */
function resolveDomName(haystack: string): string | undefined {
    const h = haystack.toLowerCase();
    if (h.includes("notallowederror") || h.includes("type_not_allowed_error"))
        return "NotAllowedError";
    if (h.includes("aborterror")) return "AbortError";
    if (
        h.includes("invalidstateerror") ||
        h.includes("type_invalid_state_error")
    )
        return "InvalidStateError";
    if (h.includes("constrainterror") || h.includes("type_constraint_error"))
        return "ConstraintError";
    if (h.includes("securityerror") || h.includes("type_security_error"))
        return "SecurityError";
    if (
        h.includes("notsupportederror") ||
        h.includes("type_not_supported_error")
    )
        return "NotSupportedError";
    if (h.includes("dataerror") || h.includes("type_data_error"))
        return "DataError";
    if (h.includes("unknownerror") || h.includes("type_unknown_error"))
        return "UnknownError";
    return undefined;
}

type NativeEnvelope = { type?: string; message?: string };

function tryParseEnvelope(raw: string): NativeEnvelope | null {
    if (!raw.startsWith("{")) return null;
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (
            parsed &&
            typeof parsed === "object" &&
            ("type" in parsed || "message" in parsed)
        ) {
            return parsed as NativeEnvelope;
        }
    } catch {
        // not JSON — fall through to the bare-string path
    }
    return null;
}

/**
 * Anti-corruption parse for native plugin rejects. Android sends a
 * `{ type, message }` envelope; iOS sends a bare DOMException-name string. Both
 * collapse to `{ name?, gpsCode?, message }` here so the Tauri bridge can throw
 * a plain `Error` ox will wrap and `classifyWebauthnError` can read back.
 */
export function parseNativeWebauthnError(raw: string): {
    name?: string;
    gpsCode?: string;
    message: string;
} {
    const envelope = tryParseEnvelope(raw);
    const message = envelope
        ? `${envelope.type ?? ""} ${envelope.message ?? ""}`.trim()
        : raw;
    const name = resolveDomName(
        envelope ? `${envelope.type ?? ""} ${message}` : raw
    );
    const gpsCode = message.match(GPS_CODE_PATTERN)?.[1];
    return { name, gpsCode, message };
}

type KindResult = { kind: WebauthnErrorKind; retryable: boolean };

// GPS code → bucket (FIDO2 path, where the `[50xxx]` prefix survives). Codes
// from the Corbado reference. A code outside this map falls through to the
// DOMException/`TYPE_*`/prose signals rather than forcing `unknown`.
const GPS_KIND: Record<string, KindResult> = {
    "50162": { kind: "sync-failed", retryable: true },
    "50161": { kind: "sync-failed", retryable: true },
    "50191": { kind: "sync-failed", retryable: true },
    "50166": { kind: "no-screen-lock", retryable: true },
    "50157": { kind: "already-registered", retryable: false },
    "50111": { kind: "already-registered", retryable: false },
    "50156": { kind: "no-credential", retryable: false },
    "50158": { kind: "unsupported", retryable: false },
    "50174": { kind: "unsupported", retryable: false },
    "50177": { kind: "unsupported", retryable: false },
    "50152": { kind: "security", retryable: false },
    "50175": { kind: "security", retryable: false },
    "50179": { kind: "security", retryable: false },
};

function getGpsCode(error: Error): string | undefined {
    const tagged = (error as Error & { gpsCode?: unknown }).gpsCode;
    if (typeof tagged === "string") return tagged;
    return error.message.match(GPS_CODE_PATTERN)?.[1];
}

function collectSignals(error: unknown): {
    haystack: string;
    gpsCode?: string;
    message: string;
} {
    const parts: string[] = [];
    let gpsCode: string | undefined;
    let message = "";
    let current: unknown = error;
    for (let depth = 0; depth < 8 && current; depth++) {
        if (current instanceof Error) {
            if (current.name) parts.push(current.name);
            if (current.message) {
                parts.push(current.message);
                message = current.message;
            }
            gpsCode ??= getGpsCode(current);
            current = current.cause;
        } else if (typeof current === "string") {
            parts.push(current);
            message = current;
            break;
        } else {
            break;
        }
    }
    return { haystack: parts.join(" ").toLowerCase(), gpsCode, message };
}

function kindFromSignals(
    name: string | undefined,
    haystack: string
): KindResult {
    // GPM "folsom" sync/decrypt failure (50162/50161/50191). On the Credential
    // Manager path GPS strips the `[50xxx]` prefix, so the numeric code is gone
    // and the localized DOMException name collapses onto NotAllowedError — the
    // decrypt/folsom message text is the only locale-stable signal left, and it
    // MUST win over the `cancelled` fallback below.
    if (
        haystack.includes("folsom") ||
        haystack.includes("decrypt the private key")
    )
        return { kind: "sync-failed", retryable: true };
    if (
        name === "InvalidStateError" ||
        haystack.includes("excluded credential")
    )
        return { kind: "already-registered", retryable: false };
    if (name === "ConstraintError" || haystack.includes("screen lock"))
        return { kind: "no-screen-lock", retryable: true };
    if (
        haystack.includes("type_no_credential") ||
        haystack.includes("no credential")
    )
        return { kind: "no-credential", retryable: false };
    // Platform/provider can't satisfy the request: register with no eligible
    // provider (TYPE_NO_CREATE_OPTIONS), Credential Manager unsupported
    // (TYPE_GET_CREDENTIAL_UNSUPPORTED_EXCEPTION), or a web NotSupportedError.
    if (
        name === "NotSupportedError" ||
        haystack.includes("type_no_create_option") ||
        haystack.includes("no create option") ||
        haystack.includes("type_get_credential_unsupported")
    )
        return { kind: "unsupported", retryable: false };
    if (name === "SecurityError") return { kind: "security", retryable: false };
    // User dismissed/aborted, or a transient concurrency interruption
    // (TYPE_USER_CANCELED / TYPE_INTERRUPTED) — soft, retryable, not reported.
    if (
        name === "NotAllowedError" ||
        name === "AbortError" ||
        haystack.includes("cancel") ||
        haystack.includes("aborted") ||
        haystack.includes("interrupted")
    )
        return { kind: "cancelled", retryable: true };
    return { kind: "unknown", retryable: true };
}

/**
 * Classify any thrown value (web DOMException, ox `CreateFailedError`/
 * `SignFailedError`, or a bridge-normalised native `Error`) by walking its
 * `.cause` chain. Signal priority: mapped GPS code → DOMException/`TYPE_*` enum
 * → prose. A *mapped* GPS code wins outright; an unmapped one defers to the
 * DOMException/`TYPE_*`/prose signals (see `classifyWebauthnError`).
 */
export function classifyWebauthnError(error: unknown): WebauthnError {
    const { haystack, gpsCode, message } = collectSignals(error);
    const name = resolveDomName(haystack);
    // A *mapped* GPS code is the most precise signal (FIDO2 path, where the
    // `[50xxx]` prefix survives) and wins outright. An *unmapped* code defers
    // to the DOMException/`TYPE_*`/prose signals instead of forcing `unknown`,
    // so a real security/unsupported/folsom failure keeps its actionable bucket.
    const mapped = gpsCode ? GPS_KIND[gpsCode] : undefined;
    const { kind, retryable } = mapped ?? kindFromSignals(name, haystack);
    return { kind, retryable, name, gpsCode, message };
}

/** True when the user dismissed/aborted the ceremony. */
export function isUserCancellation(error: unknown): boolean {
    return classifyWebauthnError(error).kind === "cancelled";
}

/** True when registration failed because a passkey already exists (excludeCredentials match). */
export function isAuthenticatorAlreadyRegistered(error: unknown): boolean {
    return classifyWebauthnError(error).kind === "already-registered";
}

/** True when the failure is a developer-actionable bug worth a Crashlytics non-fatal. */
export function isReportableWebauthnError(error: unknown): boolean {
    return REPORTABLE_KINDS.has(classifyWebauthnError(error).kind);
}

/** Analytics breadcrumb fields derived from a WebAuthn failure. */
export function webauthnErrorContext(error: unknown): {
    webauthn_error_kind: WebauthnErrorKind;
    webauthn_error_name?: string;
    gps_code?: string;
    webauthn_retryable: boolean;
} {
    const { kind, name, gpsCode, retryable } = classifyWebauthnError(error);
    return {
        webauthn_error_kind: kind,
        webauthn_error_name: name,
        gps_code: gpsCode,
        webauthn_retryable: retryable,
    };
}
