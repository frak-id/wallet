type HeadersLike = Record<string, string | undefined> | Headers;

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
 * How many entries at the *right* end of `x-forwarded-for` to skip before
 * reaching the real client IP.
 *
 * Topology: internet -> GCP L4 LoadBalancer (passthrough, doesn't touch
 * headers) -> ingress-nginx (appends the peer IP it sees) -> this pod. A
 * single trusted hop, hence the default of `1`. No Cloudflare/vendor edge
 * sits in front, so vendor headers (`cf-connecting-ip`, `true-client-ip`,
 * `fastly-client-ip`, ...) are attacker-controlled here and must not be trusted.
 */
function getTrustedProxyHops(): number {
    const raw = Number.parseInt(
        process.env.RATE_LIMIT_TRUSTED_PROXY_HOPS ?? "1",
        10
    );
    return Number.isFinite(raw) && raw >= 0 ? raw : 1;
}

/**
 * Extract the client IP from `x-forwarded-for`, anchored from the right:
 * each trusted proxy appends the address it received the request from, so
 * skipping `TRUSTED_PROXY_HOPS` entries from the right lands on the address
 * seen by the first trusted proxy. Everything left of that is
 * attacker-controlled and must never be trusted.
 */
function extractFromForwardedFor(value: string): string | null {
    const ips = value
        .split(",")
        .map((ip) => ip.trim())
        .filter(Boolean);
    if (ips.length === 0) return null;

    const index = ips.length - getTrustedProxyHops();
    if (index < 0) {
        // Fewer entries than expected trusted hops: fail safe, fall through
        // to server.requestIP() rather than trust the left-most entry.
        return null;
    }
    return ips[index] ?? null;
}

/**
 * Extract the client IP from a request.
 *
 * Resolution order:
 *  1. `x-forwarded-for`, anchored from the right, stripping
 *     `RATE_LIMIT_TRUSTED_PROXY_HOPS` trusted proxy entries (see above).
 *  2. Bun's native `server.requestIP()` (direct socket peer).
 *  3. Explicit `remoteAddress` fallback (e.g. WebSocket `ws.remoteAddress`).
 */
export function getClientIp({
    request,
    headers,
    server,
    remoteAddress,
}: {
    request?: Request;
    headers: HeadersLike;
    server?: {
        requestIP?: (req: Request) => { address: string } | null;
    } | null;
    remoteAddress?: string;
}): string | null {
    const forwardedFor = getHeaderValue(headers, "x-forwarded-for");
    if (forwardedFor) {
        const ip = extractFromForwardedFor(forwardedFor);
        if (ip) return ip;
    }

    if (request && server?.requestIP) {
        const socketAddress = server.requestIP(request);
        if (socketAddress) {
            return socketAddress.address;
        }
    }

    if (remoteAddress) {
        return remoteAddress;
    }

    return null;
}
