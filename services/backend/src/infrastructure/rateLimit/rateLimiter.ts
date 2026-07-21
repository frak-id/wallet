import { isRunningLocally } from "@frak-labs/app-essentials";
import { Elysia, status } from "elysia";
import { log } from "../external/logger";
import { infraMetrics } from "../telemetry/infraMetrics";
import { getClientIp } from "./ipExtraction";

interface RateLimitWindow {
    currentCount: number;
    // Count from the sub-window immediately preceding currentStart.
    previousCount: number;
    currentStart: number;
    // windowMs this entry was created with, for reset/purge bookkeeping.
    windowMs: number;
}

interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
}

const defaultConfig: RateLimitConfig = {
    windowMs: 60_000,
    maxRequests: 60,
};

/**
 * In-memory sliding window *counter* rate limiter keyed by client IP: each
 * key tracks the current fixed sub-window plus the immediately preceding
 * one, and the effective count is `currentCount` plus a time-weighted
 * portion of `previousCount`. This bounds bursts to ~`maxRequests` over any
 * rolling `windowMs` span (a classic fixed window can allow up to 2x right
 * at the boundary); it's an approximation assuming uniform request
 * distribution in the previous sub-window, not an exact sliding log.
 *
 * Entries are lazily rolled/evicted on access — no background timer needed.
 * Suitable for single-instance deployments. For multi-replica k8s
 * deployments, swap the Map for Redis.
 */
export class InMemoryRateLimitStore {
    private readonly windows = new Map<string, RateLimitWindow>();

    /** Advance `entry` to the sub-window containing `now`. No-op if still current. */
    private roll(
        entry: RateLimitWindow,
        config: RateLimitConfig,
        now: number
    ): void {
        const elapsed = now - entry.currentStart;
        if (elapsed < config.windowMs) return;

        if (elapsed >= config.windowMs * 2) {
            // Idle long enough that nothing carries over.
            entry.previousCount = 0;
            entry.currentCount = 0;
            entry.currentStart = now;
        } else {
            entry.previousCount = entry.currentCount;
            entry.currentCount = 0;
            entry.currentStart += config.windowMs;
        }
    }

    private estimate(
        entry: RateLimitWindow,
        config: RateLimitConfig,
        now: number
    ): number {
        const weightOfPrevious = Math.max(
            0,
            1 - (now - entry.currentStart) / config.windowMs
        );
        return entry.currentCount + entry.previousCount * weightOfPrevious;
    }

    consume(key: string, config: RateLimitConfig): boolean {
        // Skip locally: all requests are loopback, so E2E/dev tooling trips
        // the buckets instantly. Tree-shaken out of real builds.
        if (isRunningLocally) return true;

        const now = Date.now();
        let entry = this.windows.get(key);

        if (!entry) {
            entry = {
                currentCount: 0,
                previousCount: 0,
                currentStart: now,
                windowMs: config.windowMs,
            };
            this.windows.set(key, entry);
        } else {
            this.roll(entry, config, now);
        }

        entry.currentCount++;
        return this.estimate(entry, config, now) <= config.maxRequests;
    }

    getRemaining(key: string, config: RateLimitConfig): number {
        const entry = this.windows.get(key);
        if (!entry) return config.maxRequests;

        const now = Date.now();
        this.roll(entry, config, now);
        const used = Math.ceil(this.estimate(entry, config, now));
        return Math.max(0, config.maxRequests - used);
    }

    getResetAt(key: string, config: RateLimitConfig): number {
        const entry = this.windows.get(key);
        if (!entry) return Date.now();

        const now = Date.now();
        this.roll(entry, config, now);
        // Earliest point the previous sub-window's weight hits zero.
        return entry.currentStart + config.windowMs;
    }

    /**
     * Purge entries with no residual effect: only safe once *two* full
     * `windowMs` have elapsed since `currentStart`, since before that the
     * entry hasn't been rolled yet and its `currentCount` would still carry
     * over as `previousCount` weight. Purging earlier would grant a fresh
     * bucket right after a maxed-out burst.
     */
    purgeExpired(): void {
        const now = Date.now();
        for (const [key, window] of this.windows) {
            if (now - window.currentStart >= window.windowMs * 2) {
                this.windows.delete(key);
            }
        }
    }
}

const stores: InMemoryRateLimitStore[] = [];

export function createRateLimitStore(): InMemoryRateLimitStore {
    const store = new InMemoryRateLimitStore();
    stores.push(store);
    return store;
}

// Purge expired entries every 5 minutes across all stores
setInterval(() => {
    for (const store of stores) {
        store.purgeExpired();
    }
}, 5 * 60_000).unref();

type KeyExtractor = (ctx: {
    request: Request;
    headers: Record<string, string | undefined>;
    server: { requestIP?: (req: Request) => { address: string } | null } | null;
    // Resolved values from upstream plugins / macros (e.g. identityContext)
    // are not statically known here; callers type-cast when consuming.
    [key: string]: unknown;
}) => string | null;

type RateLimitOptions = Partial<RateLimitConfig> & {
    /**
     * Rate-limit key extractor. Default: client IP (DDoS defence).
     * Return `null` to skip the bucket for this request (useful when the key
     * depends on an upstream-resolved value that is legitimately absent —
     * e.g. identity-based buckets on anonymous routes).
     */
    keyExtractor?: KeyExtractor;
};

const ipKeyExtractor: KeyExtractor = ({ request, headers, server }) => {
    const ip = getClientIp({
        request,
        headers: headers as Record<string, string | undefined>,
        server: server as {
            requestIP?: (req: Request) => { address: string } | null;
        } | null,
    });
    if (!ip) {
        log.warn("Rate limit: could not resolve client IP, allowing");
        return null;
    }
    return `ip:${ip}`;
};

export function rateLimitMiddleware(config?: RateLimitOptions) {
    const { keyExtractor = ipKeyExtractor, ...configOverrides } = config ?? {};
    const finalConfig = { ...defaultConfig, ...configOverrides };
    const store = new InMemoryRateLimitStore();
    stores.push(store);

    return new Elysia({ name: "Middleware.rateLimit", seed: finalConfig })
        .onBeforeHandle((ctx) => {
            const key = keyExtractor(
                ctx as unknown as Parameters<KeyExtractor>[0]
            );
            if (key === null) return;
            const allowed = store.consume(key, finalConfig);
            if (!allowed) {
                log.warn({ key }, "Rate limit exceeded");
                infraMetrics.rateLimitRejected(
                    (ctx as { route?: string }).route ?? "unknown"
                );
                const retryAfterSec = Math.max(
                    1,
                    Math.ceil(
                        (store.getResetAt(key, finalConfig) - Date.now()) / 1000
                    )
                );
                ctx.set.headers["retry-after"] = String(retryAfterSec);
                return status(429, "Too Many Requests");
            }
        })
        .as("scoped");
}
