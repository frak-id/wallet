type HeadersLike = Record<string, string | undefined> | Headers;

const proxyHeaders = [
    "x-forwarded-for",
    "x-real-ip",
    "x-client-ip",
    "cf-connecting-ip",
    "fastly-client-ip",
    "x-cluster-client-ip",
    "true-client-ip",
    "cf-pseudo-ipv4",
    "fly-client-ip",
    "forwarded-for",
    "appengine-user-ip",
] as const;

function getHeaderValue(
    headers: HeadersLike,
    name: string
): string | undefined | null {
    if (headers instanceof Headers) {
        return headers.get(name);
    }
    return headers[name];
}

/**
 * Extract the client IP from a request.
 *
 * Resolution order:
 *  1. Trusted proxy headers (nginx ingress, cloudflare, etc.)
 *  2. Bun's native `server.requestIP()` (direct connection)
 *
 * For `x-forwarded-for`, only the first (left-most) IP is used
 * since it's the original client IP set by the first proxy.
 */
export function getClientIp({
    request,
    headers,
    server,
}: {
    request: Request;
    headers: HeadersLike;
    server: { requestIP?: (req: Request) => { address: string } | null } | null;
}): string | null {
    for (const header of proxyHeaders) {
        const value = getHeaderValue(headers, header);
        if (value) {
            // x-forwarded-for can be comma-separated: client, proxy1, proxy2
            if (header === "x-forwarded-for") {
                return value.split(",")[0]?.trim() ?? null;
            }
            return value.trim();
        }
    }

    if (server?.requestIP) {
        const socketAddress = server.requestIP(request);
        if (socketAddress) {
            return socketAddress.address;
        }
    }

    return null;
}
