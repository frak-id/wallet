import {
    blockchainContext,
    cacheContext,
    postgresContext,
} from "@backend-common";
import { drizzle } from "drizzle-orm/postgres-js";
import { Elysia } from "elysia";
import {
    productOracleTable,
    purchaseStatusEnum,
    purchaseStatusTable,
} from "./db/schema";

export const businessContext = new Elysia({
    name: "business-context",
})
    .use(cacheContext)
    .use(blockchainContext)
    .use(postgresContext)
    .decorate(({ postgresDb, ...decorators }) => ({
        ...decorators,
        businessDb: drizzle(postgresDb, {
            schema: {
                productOracleTable,
                purchaseStatusEnum,
                purchaseStatusTable,
            },
        }),
    }))
    .as("plugin");

export type BusinessContextApp = typeof businessContext;

export type BusinessDb = BusinessContextApp["decorator"]["businessDb"];
