import { drizzle } from "drizzle-orm/postgres-js";
import { Elysia } from "elysia";
import { blockchainContext, postgresContext } from "../../common/context";
import * as dbSchema from "./db/schema";

export const businessOracleContext = new Elysia({
    name: "business-oracle-context",
})
    .use(blockchainContext)
    .use(postgresContext)
    .decorate(({ postgresDb, ...decorators }) => ({
        ...decorators,
        oracleDb: drizzle(postgresDb, {
            schema: dbSchema,
        }),
    }));

export type BusinessOracleContextApp = typeof businessOracleContext;
