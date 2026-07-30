import { rateLimitMiddleware } from "@backend-infrastructure";
import { Elysia } from "elysia";
import { trackInteractionRoute } from "./interaction";
import { trackPurchaseRoute } from "./purchase";

/**
 * Rate limiting for `track/*` (README §3.6). Unlike every sibling identity
 * route, this API had no limiter at all — the first gap closed here.
 *
 * Two buckets, stacked, keyed differently, `maxRequests` deliberately
 * unequal:
 *
 *  - identity-keyed, `track:{merchantId}:{clientId}` — the meaningful bucket
 *    once a caller identifies itself. CGNAT makes IP-only limiting both too
 *    harsh (many legitimate users behind one IP) and too weak (one attacker
 *    behind many IPs), so this is the primary defence once identity is known.
 *  - IP-keyed catch-all (the module default extractor) — covers requests
 *    that carry neither `x-frak-client-id` nor `merchantId`, which
 *    `trackClientKeyExtractor` deliberately returns `null` for.
 *
 * `keyExtractor` returning `null` SKIPS the limiter for that request instead
 * of falling back to IP (`rateLimiter.ts` — `if (key === null) return;`), so
 * the identity bucket alone would leave every header-less request completely
 * unlimited. The IP-keyed bucket below is what actually covers that case —
 * it is not redundant.
 *
 * Elysia dedupes plugins by `name` + `seed`, and `seed` is `finalConfig`
 * (`{ windowMs, maxRequests }`), which excludes `keyExtractor`. Two
 * `rateLimitMiddleware` instances with identical config therefore collapse
 * into a single plugin and one of the two buckets silently never runs — so
 * `maxRequests` below must differ between the two calls, not just look
 * different in source. See `index.test.ts` for the empirical regression
 * test covering exactly this.
 *
 * The store is in-memory per-pod (`rateLimiter.ts`), so with N replicas the
 * effective limit is N× the configured value here — same caveat as §3.3.
 */
export function trackClientKeyExtractor(ctx: {
    headers: Record<string, string | undefined>;
    body?: unknown;
}): string | null {
    const clientId = ctx.headers["x-frak-client-id"];
    const merchantId = extractMerchantId(ctx.body);
    if (!clientId || !merchantId) {
        return null;
    }
    return `track:${merchantId}:${clientId}`;
}

function extractMerchantId(body: unknown): string | undefined {
    if (typeof body !== "object" || body === null) {
        return undefined;
    }
    const merchantId = (body as { merchantId?: unknown }).merchantId;
    return typeof merchantId === "string" ? merchantId : undefined;
}

export const trackApi = new Elysia({ prefix: "/track" })
    .use(
        rateLimitMiddleware({
            windowMs: 60_000,
            maxRequests: 120,
            keyExtractor: trackClientKeyExtractor,
        })
    )
    .use(
        rateLimitMiddleware({
            windowMs: 60_000,
            maxRequests: 300,
        })
    )
    .use(trackInteractionRoute)
    .use(trackPurchaseRoute);
