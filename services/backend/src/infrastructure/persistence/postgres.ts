import {
    backendTrackerTable,
    interactionSimulationStatus,
    interactionsPurchaseTrackerTable,
    pendingInteractionsTable,
    pushedInteractionsTable,
} from "@backend-domain/interactions";
import { pushTokensTable } from "@backend-domain/notifications";
import {
    productOracleTable,
    purchaseItemTable,
    purchaseStatusEnum,
    purchaseStatusTable,
} from "@backend-domain/oracle";
import {
    pairingSignatureRequestTable,
    pairingTable,
} from "@backend-domain/pairing";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

/**
 * Postgres master client
 */
const postgresDb = postgres({
    host: process.env.POSTGRES_HOST,
    port: Number.parseInt(process.env.POSTGRES_PORT ?? "5432", 10),
    database: process.env.POSTGRES_DB,
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
});

/**
 * Master DB connection
 */
export const db = drizzle({
    client: postgresDb,
    schema: {
        // Interaction domain
        pendingInteractionsTable,
        interactionSimulationStatus,
        pushedInteractionsTable,
        interactionsPurchaseTrackerTable,
        backendTrackerTable,
        // Notification domain
        pushTokensTable,
        // Oracle domain
        productOracleTable,
        purchaseStatusEnum,
        purchaseStatusTable,
        purchaseItemTable,
        // Pairing domain
        pairingTable,
        pairingSignatureRequestTable,
    },
});
