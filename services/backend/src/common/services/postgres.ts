import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
    fixedRoutingTable,
    walletRoutingTable,
} from "../../domain/6degrees/db/schema";
import { pendingInteractionsTable } from "../../domain/interactions";
import {
    backendTrackerTable,
    interactionSimulationStatus,
    interactionsPurchaseTrackerTable,
    pushedInteractionsTable,
} from "../../domain/interactions/db/schema";
import { pushTokensTable } from "../../domain/notifications";
import {
    productOracleTable,
    purchaseStatusEnum,
    purchaseStatusTable,
} from "../../domain/oracle";
import { purchaseItemTable } from "../../domain/oracle/db/schema";
import {
    pairingSignatureRequestTable,
    pairingTable,
} from "../../domain/pairing";

/**
 * Postgres master client
 */
const postgresDb = postgres({
    host: process.env.POSTGRES_HOST,
    port: Number.parseInt(process.env.POSTGRES_PORT ?? "5432"),
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
        // 6 degrees domain
        fixedRoutingTable,
        walletRoutingTable,
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
