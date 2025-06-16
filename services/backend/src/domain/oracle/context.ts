import { postgresDb } from "@backend-common";
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
import { OracleWebhookService } from "./services/hookService";
import { OracleProofService } from "./services/proofService";
import { UpdateOracleService } from "./services/updateService";

export const oracleContext = new Elysia({
    name: "Context.oracle",
})
    .decorate(() => {
        const oracleDb = drizzle({
            client: postgresDb,
            schema: {
                productOracleTable,
                purchaseStatusEnum,
                purchaseStatusTable,
                purchaseItemTable,
            },
        });
        const merkleRepository = new MerkleTreeRepository(oracleDb);
        return {
            oracle: {
                db: oracleDb,
                repositories: {
                    merkleTree: merkleRepository,
                },
                services: {
                    webhook: new OracleWebhookService(oracleDb),
                    proof: new OracleProofService(oracleDb, merkleRepository),
                    update: new UpdateOracleService(oracleDb, merkleRepository),
                },
            },
        };
    })
    .as("scoped");

export type OracleContextApp = typeof oracleContext;

export type OracleDb = PostgresJsDatabase<{
    productOracleTable: typeof productOracleTable;
    purchaseStatusEnum: typeof purchaseStatusEnum;
    purchaseStatusTable: typeof purchaseStatusTable;
    purchaseItemTable: typeof purchaseItemTable;
}>;
