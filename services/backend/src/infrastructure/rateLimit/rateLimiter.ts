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
class InMemoryRateLimitStore {
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

const globalStore = new InMemoryRateLimitStore();

// Purge expired entries every 5 minutes
setInterval(() => globalStore.purgeExpired(), 5 * 60_000).unref();

export function rateLimitMiddleware(config?: Partial<RateLimitConfig>) {
    const finalConfig = { ...defaultConfig, ...config };

    return new Elysia({ name: "Middleware.rateLimit", seed: finalConfig })
        .onBeforeHandle(({ request, headers, server }) => {
            const ip = getClientIp({
                request,
                headers,
                server: server as {
                    requestIP?: (req: Request) => { address: string } | null;
                } | null,
            });
            if (!ip) {
                log.warn("Rate limit: could not resolve client IP, allowing");
                return;
            }

            const allowed = globalStore.consume(ip, finalConfig);
            if (!allowed) {
                log.warn({ ip }, "Rate limit exceeded");
                return status(429, "Too Many Requests");
            }
        })
        .as("scoped");
}
