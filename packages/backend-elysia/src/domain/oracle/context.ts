import { blockchainContext, dbContext, eventsContext } from "@backend-common";
import { t } from "@backend-utils";
import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js/driver";
import { Elysia } from "elysia";
import {
    productOracleTable,
    purchaseItemTable,
    purchaseStatusEnum,
    purchaseStatusTable,
} from "./db/schema";
import { MerkleTreeRepository } from "./repositories/MerkleTreeRepository";

export const oracleContext = new Elysia({
    name: "Context.oracle",
})
    .use(blockchainContext)
    .use(dbContext)
    .use(eventsContext)
    .decorate(({ postgresDb, ...decorators }) => {
        const oracleDb = drizzle({
            client: postgresDb,
            schema: {
                productOracleTable,
                purchaseStatusEnum,
                purchaseStatusTable,
                purchaseItemTable,
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
    .as("scoped");

export type OracleContextApp = typeof oracleContext;

export type OracleDb = PostgresJsDatabase<{
    productOracleTable: typeof productOracleTable;
    purchaseStatusEnum: typeof purchaseStatusEnum;
    purchaseStatusTable: typeof purchaseStatusTable;
    purchaseItemTable: typeof purchaseItemTable;
}>;
