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
 * Number of trusted reverse-proxy hops between the internet and this
 * process, i.e. how many entries at the *right* end of `x-forwarded-for` we
 * should skip before reaching the real client IP.
 *
 * Deployment topology (see `infra/gcp/backend.ts` +
 * `infra/components/KubernetesService.ts`): internet -> GCP L4 LoadBalancer
 * (passthrough, does not touch HTTP headers) -> ingress-nginx controller
 * (appends the peer IP it sees to `x-forwarded-for`) -> this pod. That's a
 * single trusted hop, hence the default of `1`.
 *
 * There is no Cloudflare (or any other vendor edge) in front of the
 * ingress, so vendor headers like `cf-connecting-ip` / `true-client-ip` /
 * `fastly-client-ip` are just attacker-controlled input here and must never
 * be trusted.
 */
function getTrustedProxyHops(): number {
    const raw = Number.parseInt(
        process.env.RATE_LIMIT_TRUSTED_PROXY_HOPS ?? "1",
        10
    );
    return Number.isFinite(raw) && raw >= 0 ? raw : 1;
}

/**
 * Extract the client IP from `x-forwarded-for`, anchored from the right.
 *
 * Each trusted proxy hop appends the address of whoever it received the
 * request *from* (nginx's `$proxy_add_x_forwarded_for` semantics). So with
 * `TRUSTED_PROXY_HOPS` trusted proxies in the chain, the right-most
 * `TRUSTED_PROXY_HOPS` entries were all appended by proxies we trust, and
 * the left-most of those (`ips.length - TRUSTED_PROXY_HOPS`) is the one
 * appended by the *first* trusted proxy — i.e. the real client address it
 * observed. Everything to the left of that is attacker-controlled (a
 * client can send an arbitrary `x-forwarded-for` prefix) and must never be
 * trusted.
 */
function extractFromForwardedFor(value: string): string | null {
    const ips = value
        .split(",")
        .map((ip) => ip.trim())
        .filter(Boolean);
    if (ips.length === 0) return null;

    const index = ips.length - getTrustedProxyHops();
    if (index < 0) {
        // Fewer entries than expected trusted hops (misconfigured hop count
        // or an upstream that dropped the header). Fail SAFE: return null so
        // the caller falls through to the real socket peer
        // (`server.requestIP()`), never the attacker-controlled left-most
        // entry.
        return null;
    }
    return ips[index] ?? null;
}

/**
 * Extract the client IP from a request.
 *
 * Resolution order:
 *  1. `x-forwarded-for`, anchored from the right and stripping
 *     `RATE_LIMIT_TRUSTED_PROXY_HOPS` trusted proxy entries (see comment
 *     above — defaults to the single ingress-nginx hop in front of this
 *     service).
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
