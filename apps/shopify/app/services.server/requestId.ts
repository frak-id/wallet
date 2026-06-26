/**
 * Derive a stable per-request id from AWS trace headers so the id shown to the
 * merchant matches what we log. Returns `undefined` when no AWS header is
 * present (local dev) — callers omit the reference line / substitute a log
 * placeholder, so no sentinel string crosses the server/client boundary.
 *
 * Priority: x-amzn-trace-id (Root segment) → x-amz-cf-id → undefined.
 */
export function getRequestId(request: Request): string | undefined {
    const trace = request.headers.get("x-amzn-trace-id");
    if (trace) {
        // AWS emits Root= as the first segment; fall back to the raw trace
        // otherwise (still a stable, greppable id).
        const root = trace.split(";").find((p) => p.startsWith("Root="));
        if (root) return root.slice("Root=".length);
        return trace;
    }
    // `||` (not `??`) so an empty `x-amz-cf-id: ""` also collapses to undefined.
    return request.headers.get("x-amz-cf-id") || undefined;
}
