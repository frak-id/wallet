import { isRunningLocally } from "@frak-labs/app-essentials";
import { Elysia, status } from "elysia";
import { log } from "../external/logger";
import { infraMetrics } from "../telemetry/infraMetrics";
import { getClientIp } from "./ipExtraction";

interface RateLimitWindow {
    // Count of requests consumed since `currentStart`.
    currentCount: number;
    // Count of requests consumed in the window immediately preceding this one.
    previousCount: number;
    // Start timestamp (ms) of the current fixed sub-window.
    currentStart: number;
    // windowMs this entry was tracked with, kept for reset/purge bookkeeping
    // without requiring config on every read.
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
 * In-memory sliding window rate limiter keyed by client IP.
 *
 * Implemented as a sliding window *counter* (not a fixed window): each key
 * tracks the current fixed sub-window plus the immediately preceding one,
 * and the effective count is the current count plus a time-weighted portion
 * of the previous count. This bounds bursts to ~`maxRequests` over any
 * rolling `windowMs` span, including across sub-window boundaries — unlike a
 * classic fixed window, which can allow up to 2x `maxRequests` right at the
 * boundary. It's an approximation (assumes uniform request distribution
 * within the previous sub-window) rather than an exact sliding log, which is
 * the standard, cheap-memory tradeoff for this technique.
 *
 * Entries are lazily rolled/evicted on access — no background timer needed.
 * Suitable for single-instance deployments. For multi-replica k8s
 * deployments, swap the Map for Redis.
 */
export class InMemoryRateLimitStore {
    private readonly windows = new Map<string, RateLimitWindow>();

    /**
     * Advance `entry` to the sub-window containing `now`, mutating it in
     * place. No-op if `now` is still within the current sub-window.
     */
    private roll(
        entry: RateLimitWindow,
        config: RateLimitConfig,
        now: number
    ): void {
        const elapsed = now - entry.currentStart;
        if (elapsed < config.windowMs) return;

        if (elapsed >= config.windowMs * 2) {
            // Idle for more than a full extra window: nothing carries over.
            entry.previousCount = 0;
            entry.currentCount = 0;
            entry.currentStart = now;
        } else {
            entry.previousCount = entry.currentCount;
            entry.currentCount = 0;
            entry.currentStart += config.windowMs;
        }
    }

    /** Time-weighted effective request count within the trailing `windowMs`. */
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
        // Previous sub-window's weight reaches zero at the end of the
        // current sub-window — the earliest point the bucket is guaranteed
        // to have room again.
        return entry.currentStart + config.windowMs;
    }

    /**
     * Purge entries old enough to carry no residual effect. An entry is only
     * truly inert once *two* full `windowMs` have elapsed since
     * `currentStart`: in the `[windowMs, 2*windowMs)` range the entry has not
     * been lazily rolled yet, so its `currentCount` would still carry over as
     * `previousCount` weight on the next `estimate()`. Dropping it earlier
     * would grant a fresh bucket right after a maxed-out burst.
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
                        (store.getResetAt(key, finalConfig) - Date.now()) /
                            1000
                    )
                );
                ctx.set.headers["retry-after"] = String(retryAfterSec);
                return status(429, "Too Many Requests");
            }
        })
        .as("scoped");
}
