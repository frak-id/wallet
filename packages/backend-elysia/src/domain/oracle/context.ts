import {
    adminWalletContext,
    blockchainContext,
    postgresContext,
} from "@backend-common";
import { t } from "@backend-utils";
import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js/driver";
import { Elysia } from "elysia";
import {
    productOracleTable,
    purchaseStatusEnum,
    purchaseStatusTable,
} from "./db/schema";
import { MerkleTreeRepository } from "./repositories/MerkleTreeRepository";

export const oracleContext = new Elysia({
    name: "Context.oracle",
})
    .use(blockchainContext)
    .use(postgresContext)
    .use(adminWalletContext)
    .decorate(({ postgresDb, ...decorators }) => {
        const oracleDb = drizzle(postgresDb, {
            schema: {
                productOracleTable,
                purchaseStatusEnum,
                purchaseStatusTable,
            },
        });
        return {
            ...decorators,
            oracleDb,
            merkleRepository: new MerkleTreeRepository(oracleDb),
        };
    })
    .guard({
        params: t.Object({
            productId: t.Optional(t.Hex()),
        }),
    })
    .as("plugin");

export type OracleContextApp = typeof oracleContext;

export type OracleDb = PostgresJsDatabase<{
    productOracleTable: typeof productOracleTable;
    purchaseStatusEnum: typeof purchaseStatusEnum;
    purchaseStatusTable: typeof purchaseStatusTable;
}>;
