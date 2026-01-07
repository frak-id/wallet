import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
    touchpointsTable,
    touchpointSourceEnum,
} from "../../domain/attribution";
import {
    identityGroupsTable,
    identityNodesTable,
    identityTypeEnum,
} from "../../domain/identity";
import { merchantsTable } from "../../domain/merchant";
import { pushTokensTable } from "../../domain/notifications";
import {
    pairingSignatureRequestTable,
    pairingTable,
} from "../../domain/pairing";
import {
    merchantWebhooksTable,
    purchaseItemsTable,
    purchaseStatusEnum,
    purchasesTable,
    webhookPlatformEnum,
} from "../../domain/purchases";

const postgresDb = postgres({
    host: process.env.POSTGRES_HOST,
    port: Number.parseInt(process.env.POSTGRES_PORT ?? "5432", 10),
    database: process.env.POSTGRES_DB,
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
});

export const db = drizzle({
    client: postgresDb,
    schema: {
        touchpointsTable,
        touchpointSourceEnum,
        identityGroupsTable,
        identityNodesTable,
        identityTypeEnum,
        merchantsTable,
        pushTokensTable,
        merchantWebhooksTable,
        purchaseStatusEnum,
        purchasesTable,
        purchaseItemsTable,
        webhookPlatformEnum,
        pairingTable,
        pairingSignatureRequestTable,
    },
});
