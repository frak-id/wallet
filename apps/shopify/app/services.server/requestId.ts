/**
 * Derive a stable per-request id from the ingress so the id shown to the
 * merchant matches what we log. Returns `undefined` when no id header is
 * present (local dev) — callers omit the reference line / substitute a log
 * placeholder, so no sentinel string crosses the server/client boundary.
 *
 * Priority:
 *  1. `x-request-id` — nginx-ingress sets this on every upstream request and
 *     logs the same `$req_id` in its access log, so the id correlates across
 *     the merchant-facing page, the pod logs (`kubectl logs`) and the ingress
 *     logs. This is the id to grep for on the GCP/k8s deployment.
 *  2. `x-amzn-trace-id` (Root segment) / `x-amz-cf-id` — legacy AWS/CloudFront
 *     path, kept for the two-phase cutover while the canonical prod host may
 *     still be fronted by CloudFront.
 */
export function getRequestId(request: Request): string | undefined {
    // nginx-ingress (k8s) — primary source.
    const requestId = request.headers.get("x-request-id");
    if (requestId) return requestId;

    // Legacy AWS ALB/X-Ray trace header.
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
