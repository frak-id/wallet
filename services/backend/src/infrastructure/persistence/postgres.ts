import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { referralLinksTable, touchpointsTable } from "../../domain/attribution";
import { campaignRulesTable } from "../../domain/campaign";
import { identityGroupsTable, identityNodesTable } from "../../domain/identity";
import {
    merchantAdminsTable,
    merchantOwnershipTransfersTable,
    merchantsTable,
} from "../../domain/merchant";
import { pushTokensTable } from "../../domain/notifications";
import {
    pairingSignatureRequestTable,
    pairingTable,
} from "../../domain/pairing";
import {
    merchantWebhooksTable,
    purchaseClaimsTable,
    purchaseItemsTable,
    purchasesTable,
} from "../../domain/purchases";
import { assetLogsTable, interactionLogsTable } from "../../domain/rewards";

const schemaName = process.env.POSTGRES_SCHEMA || "public";

const postgresDb = postgres({
    host: process.env.POSTGRES_HOST,
    port: Number.parseInt(process.env.POSTGRES_PORT ?? "5432", 10),
    database: process.env.POSTGRES_DB,
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
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
