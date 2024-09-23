import { drizzle } from "drizzle-orm/postgres-js";
import { Elysia } from "elysia";
import { blockchainContext, postgresContext } from "../../common/context";
import {
    productOracleTable,
    purchaseStatusEnum,
    purchaseStatusTable,
} from "./db/schema";

export const businessContext = new Elysia({
    name: "business-context",
})
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
