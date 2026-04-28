/**
 * WebSocket close-code classification.
 *
 * The connection lifecycle and the per-request lifecycle are orthogonal:
 *  - Transient closes (network blips, mobile suspend) trigger silent reconnects
 *    while preserving in-flight signature requests.
 *  - Fatal closes (auth, protocol, app rejection) require user action and
 *    must reject any pending signature promises.
 *  - Silent and normal closes return to idle without UI feedback.
 *
 * Standard codes (RFC 6455):
 *   1000 Normal Closure         — clean shutdown initiated by us or the server
 *   1001 Going Away             — server restart / browser navigation
 *   1005 No Status Received     — connection dropped without a close frame
 *   1006 Abnormal Closure       — network blip, mobile suspend (most common)
 *   1011 Internal Server Error  — transient backend hiccup
 *   1012 Service Restart        — server restarting
 *   1013 Try Again Later        — server overloaded
 *   1014 Bad Gateway            — transient gateway failure
 *
 *   1002/1003/1007–1010/1015    — protocol/data/policy errors that won't fix themselves
 *
 * App-defined codes (4xxx) live in
 *   `services/backend/src/domain/pairing/dto/WebSocketCloseCode.ts`
 *   - 4401 UNAUTHORIZED
 *   - 4403 FORBIDDEN
 *   - 4404 PAIRING_NOT_FOUND
 *   - 4422 INVALID_MSG
 *   - 4444 NO_CONNECTION_TO_CONNECT_TO  (silent — wallet has no pairings yet)
 */
export type CloseClass = "normal" | "silent" | "transient" | "fatal";

const TRANSIENT_CLOSE_CODES: ReadonlySet<number> = new Set([
    1001, 1005, 1006, 1011, 1012, 1013, 1014,
]);

/** Expected non-error termination — drop back to idle without UI feedback. */
const SILENT_CLOSE_CODES: ReadonlySet<number> = new Set([4444]);

/**
 * Map a WebSocket close code to its category.
 *
 *  - `normal`    1000 — explicit user/server close, return to idle.
 *  - `silent`    4444 — expected, no-error termination, return to idle.
 *  - `transient` recoverable network/server failures, schedule reconnect
 *                while keeping pending requests alive.
 *  - `fatal`     anything else, surface error and reject pending requests.
 */
export function classifyClose(code: number): CloseClass {
    if (code === 1000) return "normal";
    if (SILENT_CLOSE_CODES.has(code)) return "silent";
    if (TRANSIENT_CLOSE_CODES.has(code)) return "transient";
    return "fatal";
}
