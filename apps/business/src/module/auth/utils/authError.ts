/**
 * Extract a readable message from an Eden error payload. The canonical
 * `t.ErrorResponse` shape emitted by every backend `HttpError` is
 * `{ success: false, code, error: <human message> }` — the message lives in
 * the `error` field, not `message`.
 *
 * Also handles an already-unwrapped `Error` (top-level `message`): our hooks
 * throw `new Error(extractAuthErrorMessage(...))`, so display sites that call
 * this again on the react-query error must surface that message (e.g. the
 * `OTP_THROTTLED` "Retry in Ns" text) instead of the generic fallback.
 */
export function extractAuthErrorMessage(
    error: unknown,
    fallback: string
): string {
    if (typeof error === "string") return error;
    return messageFromEdenValue(error) ?? messageFromError(error) ?? fallback;
}

/** The Eden error payload (`{ value: … }`) carrying an HttpError body. */
function messageFromEdenValue(error: unknown): string | undefined {
    if (!error || typeof error !== "object" || !("value" in error)) return;
    const { value } = error as { value: unknown };
    if (typeof value === "string") return value;
    if (!value || typeof value !== "object") return;
    const { error: errorField, message } = value as {
        error?: unknown;
        message?: unknown;
    };
    if (typeof errorField === "string") return errorField;
    // Non-HttpError payloads (e.g. Elysia validation) carry `message`.
    if (typeof message === "string") return message;
    return undefined;
}

/**
 * A plain `Error` (or any object carrying a non-empty `message`) — the message
 * was already extracted upstream when the error was thrown (our hooks throw
 * `new Error(extractAuthErrorMessage(...))`), so a re-extraction at the display
 * site must surface it (e.g. the `OTP_THROTTLED` "Retry in Ns" text).
 */
function messageFromError(error: unknown): string | undefined {
    if (!error || typeof error !== "object" || !("message" in error)) return;
    const { message } = error as { message?: unknown };
    if (typeof message === "string" && message.length > 0) return message;
    return undefined;
}

/**
 * Extract the typed error `code` from an Eden error payload (the
 * `t.ErrorResponse` shape `{ success, code, error }`), when present. Lets
 * the UI map a specific backend code (e.g. `EMAIL_TAKEN`) to a translated
 * message instead of echoing the raw English backend string (§2.1).
 */
export function extractAuthErrorCode(error: unknown): string | undefined {
    if (error && typeof error === "object" && "value" in error) {
        const { value } = error as { value: unknown };
        if (value && typeof value === "object" && "code" in value) {
            const { code } = value as { code: unknown };
            if (typeof code === "string") return code;
        }
    }
    return undefined;
}

/** Error carrying the backend's typed `code` so callers can map it (§2.1). */
export class AuthError extends Error {
    readonly code?: string;
    constructor(message: string, code?: string) {
        super(message);
        this.name = "AuthError";
        this.code = code;
    }
}
