import { Elysia } from "elysia";
import { LRUCache } from "lru-cache";

/**
 * Global shared LRU cache for the whole app
 */
export const cacheContext = new Elysia({
    name: "cache-context",
}).decorate(
    { as: "append" },
    {
        cache: new LRUCache({
            max: 1024,
            // biome-ignore lint/complexity/noBannedTypes: <explanation>
        }) as LRUCache<string, {}>,
    }
);
export type CacheContextApp = typeof cacheContext;
