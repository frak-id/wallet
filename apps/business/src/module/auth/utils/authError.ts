/**
 * Extract a readable message from an Eden error payload.
 */
export function extractAuthErrorMessage(
    error: unknown,
    fallback: string
): string {
    if (typeof error === "string") return error;
    if (error && typeof error === "object" && "value" in error) {
        const { value } = error as { value: unknown };
        if (typeof value === "string") return value;
        if (value && typeof value === "object" && "message" in value) {
            const { message } = value as { message: unknown };
            if (typeof message === "string") return message;
        }
    }
    return fallback;
}

/**
 * Extract the typed error `code` from an Eden error payload (the
 * `t.ErrorResponse` shape `{ success, code, message }`), when present. Lets
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
