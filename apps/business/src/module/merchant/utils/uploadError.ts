import type { TFunction } from "i18next";

const FILE_REJECTED = "This file was rejected — check the requirements above.";
const UPLOAD_FAILED = "Upload failed";

/**
 * Extract a displayable message from a media upload error.
 *
 * Two payload shapes reach here. Our own `HttpError` responses use the
 * canonical `{ success, code, error }` body, so the message is in `error`.
 * Elysia's schema validation rejects the request before the route runs — an
 * over-`maxSize` file never reaches the handler — and answers with
 * `{ type: "validation", on, message, summary, … }` instead.
 *
 * Pass `t` to translate the validation cases, whose raw text ("Expected kind
 * 'File'") means nothing to a user.
 */
export function getUploadErrorMessage(
    error: unknown,
    t?: TFunction
): string | null {
    if (!error) return null;

    // Eden attaches the decoded response body to a failed request. Prefer it
    // over Error.message, which Eden derives by stringifying that same body —
    // yielding "[object Object]" for every structured response.
    if (isEdenError(error)) {
        return messageFromBody(error.value, t) ?? fallback(t);
    }

    if (error instanceof Error && error.message) return error.message;

    return fallback(t);
}

function isEdenError(error: unknown): error is { value: unknown } {
    return typeof error === "object" && error !== null && "value" in error;
}

function messageFromBody(value: unknown, t?: TFunction): string | null {
    if (typeof value === "string") return value;
    if (typeof value !== "object" || value === null) return null;

    // Our own HttpError responses.
    const message = pickString(value, "error");
    if (message) return message;

    if (isBodyValidation(value)) {
        return t
            ? t("merchantEdit.explorer.errors.fileRejected")
            : FILE_REJECTED;
    }

    return pickString(value, "message", "summary");
}

/**
 * A schema rejection of the request body. An over-size file and a non-image
 * both land here, since `t.File` reports either as a failed kind check.
 * Matched on the validation type alone — the field name is the backend's to
 * change.
 */
function isBodyValidation(value: object): boolean {
    const { type, on } = value as { type?: unknown; on?: unknown };
    return type === "validation" && on === "body";
}

function pickString(source: object, ...keys: string[]): string | null {
    for (const key of keys) {
        const candidate = (source as Record<string, unknown>)[key];
        if (typeof candidate === "string" && candidate.length > 0) {
            return candidate;
        }
    }
    return null;
}

function fallback(t?: TFunction): string {
    return t ? t("merchantEdit.explorer.errors.uploadFailed") : UPLOAD_FAILED;
}
