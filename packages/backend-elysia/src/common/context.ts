import { isRunningInProd } from "@frak-labs/app-essentials";
import { getViemClientFromChain } from "@frak-labs/app-essentials/blockchain";
import { Elysia } from "elysia";
import postgres from "postgres";
import { Config } from "sst/node/config";
import { arbitrum, arbitrumSepolia } from "viem/chains";

/**
 * Build the common context for the app
 */
export function blockchainContext() {
    const chain = isRunningInProd ? arbitrum : arbitrumSepolia;
    const client = getViemClientFromChain({ chain });

    return new Elysia({ name: "blockchain-context" }).decorate(
        { as: "append" },
        {
            chain,
            client,
        }
    );
}

export type BlockchainContextApp = ReturnType<typeof blockchainContext>;

/**
 * Build the common context for the app
 */
export function postgresContext() {
    const pg = postgres({
        host: Config.POSTGRES_HOST,
        port: 5432,
        database: Config.POSTGRES_DB,
        username: Config.POSTGRES_USER,
        password: Config.POSTGRES_PASSWORD,
    });

    return new Elysia({ name: "postgres-context" }).decorate(
        { as: "append" },
        {
            postgresDb: pg,
        }
    );
}

export type PostgresContextApp = ReturnType<typeof postgresContext>;
