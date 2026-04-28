/**
 * WebSocket close codes that warrant a reconnect attempt. Anything not in
 * this set is considered terminal and surfaced to the UI as-is.
 *
 * Standard codes (RFC 6455):
 *   1001 Going Away — server restart / browser navigation
 *   1005 No Status Received — connection dropped without a close frame
 *   1006 Abnormal Closure — network blip, mobile suspend (most common case)
 *   1011 Internal Server Error — transient backend hiccup
 *   1012 Service Restart — server restarting
 *   1013 Try Again Later — server overloaded
 *   1014 Bad Gateway — transient gateway failure
 *
 * Non-retryable on purpose:
 *   1000 Normal Closure — clean shutdown initiated by us or the server
 *   1002/1003/1007–1010/1015 — protocol/data/policy errors that won't fix themselves
 *   4xxx (app-level) — explicit server rejections defined in
 *     `services/backend/src/domain/pairing/dto/WebSocketCloseCode.ts`
 *     (UNAUTHORIZED, FORBIDDEN, PAIRING_NOT_FOUND, INVALID_MSG,
 *     NO_CONNECTION_TO_CONNECT_TO)
 */
const RETRYABLE_CLOSE_CODES: ReadonlySet<number> = new Set([
    1001, 1005, 1006, 1011, 1012, 1013, 1014,
]);

export function isRetryableCloseCode(code: number): boolean {
    return RETRYABLE_CLOSE_CODES.has(code);
}
