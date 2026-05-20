/**
 * HTTP error helpers shared across consumers of the Eden Treaty clients.
 *
 * Eden surfaces HTTP failures as objects with a numeric `status`. Network
 * throws and library-level exceptions (e.g. WebAuthn ceremony errors) do
 * not — so a status check is sufficient to discriminate "the server told us
 * something" from "something blew up before we ever talked to it".
 */

/**
 * Extract the HTTP status from an Eden-style error, or `undefined` when the
 * thrown value is not an HTTP error (network blip, thrown JS error, ...).
 */
export function getHttpStatus(err: unknown): number | undefined {
    if (
        err &&
        typeof err === "object" &&
        "status" in err &&
        typeof (err as { status: unknown }).status === "number"
    ) {
        return (err as { status: number }).status;
    }
    return undefined;
}

/**
 * Transient = worth retrying.
 *
 * Covers network-level failures (status === 0 in fetch-like clients) and
 * server-side 5xx. Anything else either succeeded or is a permanent client
 * error — see `isPermanentHttpError`.
 */
export function isTransientHttpError(err: unknown): boolean {
    const status = getHttpStatus(err);
    return status === 0 || (status !== undefined && status >= 500);
}

/**
 * Permanent = retrying will never help. 4xx range.
 */
export function isPermanentHttpError(err: unknown): boolean {
    const status = getHttpStatus(err);
    return status !== undefined && status >= 400 && status < 500;
}

/**
 * Drop-in `retry` predicate for TanStack Query mutations / queries.
 *
 * Capped at 3 attempts and only triggers on transient failures, so a
 * WebAuthn ceremony rejection or a 4xx validation error never causes a
 * retry. Use together with `transientRetryDelay` for exponential backoff.
 *
 * ```ts
 * useMutation({
 *   retry: transientRetry,
 *   retryDelay: transientRetryDelay,
 *   ...
 * });
 * ```
 *
 * TODO: adopt in `apps/listener/app/module/hooks/useSendInteraction.ts` after preact merge is done
 */
export function transientRetry(failureCount: number, err: unknown): boolean {
    return failureCount < 3 && isTransientHttpError(err);
}

/**
 * Exponential backoff (500ms → 1s → 2s → 4s cap) for use alongside
 * `transientRetry`. Kept separate so call sites can pick a different delay
 * strategy without forking the predicate.
 */
export function transientRetryDelay(attempt: number): number {
    return Math.min(500 * 2 ** attempt, 4000);
}
