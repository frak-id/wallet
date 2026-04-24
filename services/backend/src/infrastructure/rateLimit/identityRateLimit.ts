import {
    createRateLimitStore,
    type InMemoryRateLimitStore,
} from "./rateLimiter";

type Config = {
    windowMs: number;
    maxRequests: number;
};

export type IdentityRateLimiter = {
    consume(identityKey: string): boolean;
};

/**
 * Rate limiter keyed on caller identity (wallet address, identity group id,
 * or any opaque string) instead of client IP. Wrap this around a single
 * sensitive operation — issue / rotate / redeem — to prevent a single user
 * from burning through budget regardless of where they route their
 * requests from.
 *
 * Backed by the same in-memory store as the IP limiter (auto-purged every
 * 5 minutes, single-instance only — swap for Redis when we run multiple
 * replicas).
 */
export function createIdentityRateLimit(config: Config): IdentityRateLimiter {
    const store: InMemoryRateLimitStore = createRateLimitStore();
    return {
        consume(identityKey: string): boolean {
            return store.consume(`identity:${identityKey}`, config);
        },
    };
}
