import { rateLimitMiddleware } from "@backend-infrastructure";
import { Elysia } from "elysia";
import { trackInteractionRoute } from "./interaction";
import { trackPurchaseRoute } from "./purchase";

/**
 * Two stacked rate-limit buckets: identity-keyed (`track:{merchantId}:{clientId}`,
 * the primary defence once a caller identifies itself) and an IP-keyed
 * catch-all for requests missing either field (`keyExtractor` returning
 * `null` skips the limiter entirely rather than falling back to IP, so the
 * catch-all is not redundant).
 *
 * `maxRequests` must differ between the two `rateLimitMiddleware` calls
 * below: Elysia dedupes plugins by `name` + `seed`, and `seed` excludes
 * `keyExtractor`, so identical configs collapse into one plugin and one
 * bucket silently never runs. See `index.test.ts` for the regression test.
 *
 * The store is in-memory per-pod, so with N replicas the effective limit is
 * N× the configured value here.
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
