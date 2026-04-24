import { log } from "@backend-infrastructure";
import { Elysia, status } from "elysia";
import { getClientIp } from "./ipExtraction";

interface RateLimitWindow {
    count: number;
    resetAt: number;
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
 * Entries are lazily evicted on access — no background timer needed.
 * Suitable for single-instance deployments. For multi-replica k8s
 * deployments, swap the Map for Redis.
 */
export class InMemoryRateLimitStore {
    private readonly windows = new Map<string, RateLimitWindow>();

    consume(key: string, config: RateLimitConfig): boolean {
        const now = Date.now();
        const existing = this.windows.get(key);

        if (!existing || now >= existing.resetAt) {
            this.windows.set(key, {
                count: 1,
                resetAt: now + config.windowMs,
            });
            return true;
        }

        existing.count++;
        return existing.count <= config.maxRequests;
    }

    getRemaining(key: string, config: RateLimitConfig): number {
        const entry = this.windows.get(key);
        if (!entry || Date.now() >= entry.resetAt) {
            return config.maxRequests;
        }
        return Math.max(0, config.maxRequests - entry.count);
    }

    getResetAt(key: string): number {
        const entry = this.windows.get(key);
        if (!entry || Date.now() >= entry.resetAt) {
            return Date.now();
        }
        return entry.resetAt;
    }

    /**
     * Purge expired entries to prevent unbounded memory growth.
     * Called periodically — not on every request.
     */
    purgeExpired(): void {
        const now = Date.now();
        for (const [key, window] of this.windows) {
            if (now >= window.resetAt) {
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
                return status(429, "Too Many Requests");
            }
        })
        .as("scoped");
}
