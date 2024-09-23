import { isRunningInProd } from "@frak-labs/app-essentials";
import { getViemClientFromChain } from "@frak-labs/app-essentials/blockchain";
import { Elysia } from "elysia";
import { LRUCache } from "lru-cache";
import postgres from "postgres";
import { Config } from "sst/node/config";
import { arbitrum, arbitrumSepolia } from "viem/chains";

function getChainAndClient() {
    const chain = isRunningInProd ? arbitrum : arbitrumSepolia;
    const client = getViemClientFromChain({ chain });

    return { chain, client };
}

/**
 * Build the common context for the app
 */
export const blockchainContext = new Elysia({
    name: "blockchain-context",
}).decorate({ as: "append" }, getChainAndClient());

export type BlockchainContextApp = typeof blockchainContext;

/**
 * Build the common context for the app
 */
export const postgresContext = new Elysia({
    name: "postgres-context",
}).decorate(
    { as: "append" },
    {
        postgresDb: postgres({
            host: Config.POSTGRES_HOST,
            port: 5432,
            database: Config.POSTGRES_DB,
            username: Config.POSTGRES_USER,
            password: Config.POSTGRES_PASSWORD,
        }),
    }
);

export type PostgresContextApp = typeof postgresContext;

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
