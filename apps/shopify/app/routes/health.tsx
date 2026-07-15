// Resource route (no default export) used by the Kubernetes liveness/readiness
// probes. Kept unauthenticated and dependency-free so it reflects only whether
// the server process is up and serving requests.
export function loader() {
    return new Response("OK", {
        status: 200,
        headers: { "content-type": "text/plain" },
    });
}
