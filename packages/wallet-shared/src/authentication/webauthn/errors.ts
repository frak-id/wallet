/**
 * Cross-platform WebAuthn failure classification.
 *
 * One taxonomy keyed on the WebAuthn DOMException name + Google Play Services
 * `[50xxx]` code — the locale-stable signals shared by all three surfaces:
 *  - Web: ox surfaces the raw DOMException (`.name`) as the failure `cause`.
 *  - iOS: the native plugin rejects with the DOMException name as a string.
 *  - Android: GPS collapses ~50 internal codes onto the same enum and keeps the
 *    numeric `[50xxx]` code in the message (e.g. 50162 = Google Password Manager
 *    "folsom" sync/decrypt failure).
 *
 * Prose is only a last-resort signal — native messages are localized, whereas
 * the numeric code and the DOMException / `TYPE_*` enum tokens are not.
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

// GPS code → bucket. Codes from the Corbado reference; a code outside this map
// still means a real failure (handled as `unknown`, never a user cancel).
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
    if (haystack.includes("folsom"))
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
    if (
        name === "NotSupportedError" ||
        haystack.includes("type_no_create_option") ||
        haystack.includes("no create option")
    )
        return { kind: "unsupported", retryable: false };
    if (name === "SecurityError") return { kind: "security", retryable: false };
    if (
        name === "NotAllowedError" ||
        name === "AbortError" ||
        haystack.includes("cancel") ||
        haystack.includes("aborted") ||
        haystack.includes("error 1001")
    )
        return { kind: "cancelled", retryable: true };
    return { kind: "unknown", retryable: true };
}

/**
 * Classify any thrown value (web DOMException, ox `CreateFailedError`/
 * `SignFailedError`, or a bridge-normalised native `Error`) by walking its
 * `.cause` chain. Signal priority: GPS code → DOMException/`TYPE_*` enum →
 * prose. A present GPS code always means a real failure, never a user cancel.
 */
export function classifyWebauthnError(error: unknown): WebauthnError {
    const { haystack, gpsCode, message } = collectSignals(error);
    const name = resolveDomName(haystack);
    const { kind, retryable } = gpsCode
        ? (GPS_KIND[gpsCode] ?? { kind: "unknown", retryable: true })
        : kindFromSignals(name, haystack);
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
