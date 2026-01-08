import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
    touchpointSourceEnum,
    touchpointsTable,
} from "../../domain/attribution";
import { campaignRulesTable } from "../../domain/campaign";
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
import { referralLinksTable } from "../../domain/referral";
import {
    assetLogsTable,
    assetStatusEnum,
    assetTypeEnum,
    interactionLogsTable,
    interactionTypeEnum,
    recipientTypeEnum,
} from "../../domain/rewards";

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
        campaignRulesTable,
        referralLinksTable,
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
        interactionLogsTable,
        interactionTypeEnum,
        assetLogsTable,
        assetStatusEnum,
        assetTypeEnum,
        recipientTypeEnum,
    },
});
