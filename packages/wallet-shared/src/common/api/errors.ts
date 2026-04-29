/**
 * Helpers for working with errors thrown by the eden-treaty-backed
 * `authenticatedBackendApi` / `authenticatedWalletApi` clients.
 *
 * Eden surfaces failed responses as `{ status, value }` (where `value`
 * is the parsed body — typically `HttpError.toResponse()` output:
 * `{ success: false, code, error }`). When our hooks do
 * `if (error) throw error;`, react-query stores that exact shape in
 * `mutation.error` / `query.error`. These helpers extract status / code
 * safely without callers having to know the shape, so feature code can
 * branch on HTTP status (or the backend's symbolic code) without ad-hoc
 * type guards in every component.
 */

/**
 * Backend `HttpError` response body. Backend routes declare their error
 * responses with `t.ErrorResponse`, which produces this shape.
 */
export type ApiErrorBody = {
    success?: false;
    /** Symbolic backend code, e.g. "ALREADY_ACTIVE", "CODE_UNAVAILABLE". */
    code?: string;
    /** Human-readable explanation. Avoid surfacing this directly — i18n keys are preferable. */
    error?: string;
};

/** Eden treaty's normalised error shape. */
export type ApiError = {
    status: number;
    value?: ApiErrorBody;
};

/**
 * Type guard / coercion. Returns the eden error shape if the input
 * matches it, otherwise `null` (covers thrown native `Error`s, undefined,
 * unrelated objects, etc.).
 */
export function asApiError(err: unknown): ApiError | null {
    if (typeof err !== "object" || err === null) return null;
    const status = (err as { status?: unknown }).status;
    if (typeof status !== "number") return null;
    const value = (err as { value?: unknown }).value;
    return {
        status,
        value:
            typeof value === "object" && value !== null
                ? (value as ApiErrorBody)
                : undefined,
    };
}

/** Convenience: HTTP status of an eden error (or `undefined`). */
export function getErrorStatus(err: unknown): number | undefined {
    return asApiError(err)?.status;
}

/** Convenience: backend symbolic error code (or `undefined`). */
export function getErrorCode(err: unknown): string | undefined {
    const code = asApiError(err)?.value?.code;
    return typeof code === "string" ? code : undefined;
}

/**
 * Mapping of error signatures → i18n message keys. Used by
 * {@link resolveApiErrorKey} to pick the right translated message for
 * any given thrown error.
 *
 * Lookup order is `byCode` → `byStatus` → `fallback`, so a more specific
 * symbolic code always wins over a status-only match.
 */
export type ApiErrorKeyMap = {
    /** Map backend `HttpError.code` (e.g. "ALREADY_ACTIVE") to an i18n key. */
    byCode?: Readonly<Record<string, string>>;
    /** Map HTTP status (e.g. 409, 404) to an i18n key. */
    byStatus?: Readonly<Partial<Record<number, string>>>;
    /** Used when the error doesn't match any entry above. */
    fallback?: string;
};

/**
 * Resolve a translated message key for the given error using the
 * provided mapping. Returns `null` when there is no error.
 */
export function resolveApiErrorKey(
    err: unknown,
    map: ApiErrorKeyMap
): string | null {
    if (!err) return null;
    const apiErr = asApiError(err);
    if (!apiErr) return map.fallback ?? null;

    if (apiErr.value?.code && map.byCode?.[apiErr.value.code]) {
        return map.byCode[apiErr.value.code];
    }
    if (map.byStatus?.[apiErr.status]) {
        return map.byStatus[apiErr.status] ?? null;
    }
    return map.fallback ?? null;
}
