import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
// Import schemas directly from db/schema.ts files to avoid pulling in
// domain contexts (which eagerly instantiate services and repositories)
import {
    referralLinksTable,
    touchpointsTable,
} from "../../domain/attribution/db/schema";
import { campaignRulesTable } from "../../domain/campaign/db/schema";
import {
    identityGroupsTable,
    identityNodesTable,
} from "../../domain/identity/db/schema";
import {
    merchantAdminsTable,
    merchantOwnershipTransfersTable,
    merchantsTable,
} from "../../domain/merchant/db/schema";
import {
    notificationBroadcastsTable,
    notificationSentTable,
    pushTokensTable,
} from "../../domain/notifications/db/schema";
import {
    pairingSignatureRequestTable,
    pairingTable,
} from "../../domain/pairing/db/schema";
import {
    merchantWebhooksTable,
    purchaseClaimsTable,
    purchaseItemsTable,
    purchasesTable,
} from "../../domain/purchases/db/schema";
import {
    assetLogsTable,
    interactionLogsTable,
} from "../../domain/rewards/db/schema";

const schemaName = process.env.POSTGRES_SCHEMA || "public";

const postgresDb = postgres({
    host: process.env.POSTGRES_HOST,
    port: Number.parseInt(process.env.POSTGRES_PORT ?? "5432", 10),
    database: process.env.POSTGRES_DB,
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    max: 10,
    idle_timeout: 30,
    max_lifetime: 3600,
    connection: {
        search_path: schemaName,
    },
});

export const db = drizzle({
    client: postgresDb,
    schema: {
        campaignRulesTable,
        referralLinksTable,
        touchpointsTable,
        identityGroupsTable,
        identityNodesTable,
        merchantsTable,
        merchantAdminsTable,
        merchantOwnershipTransfersTable,
        pushTokensTable,
        notificationBroadcastsTable,
        notificationSentTable,
        merchantWebhooksTable,
        purchaseClaimsTable,
        purchasesTable,
        purchaseItemsTable,
        pairingTable,
        pairingSignatureRequestTable,
        interactionLogsTable,
        assetLogsTable,
    },
});
