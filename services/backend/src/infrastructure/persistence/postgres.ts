import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
    affiliateAttributionTable,
    affiliateBrandTable,
    affiliateSyncStateTable,
} from "../../domain/affiliate/db/schema";
// Import schemas directly from db/schema.ts files to avoid pulling in
// domain contexts (which eagerly instantiate services and repositories)
import { referralLinksTable } from "../../domain/attribution/db/schema";
import { campaignRulesTable } from "../../domain/campaign/db/schema";
import {
    emailVerificationCodesTable,
    identityGroupsTable,
    identityNodesTable,
    installCodesTable,
    recoveryBlobsTable,
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
import { referralCodesTable } from "../../domain/referral-code/db/schema";
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
    prepare: false,
});

export const db = drizzle({
    client: postgresDb,
    schema: {
        campaignRulesTable,
        referralLinksTable,
        identityGroupsTable,
        identityNodesTable,
        installCodesTable,
        emailVerificationCodesTable,
        recoveryBlobsTable,
        referralCodesTable,
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
        affiliateBrandTable,
        affiliateAttributionTable,
        affiliateSyncStateTable,
    },
});

/**
 * Run `task` while holding a Postgres session-level advisory lock identified by
 * `key`, so it runs on a single process at a time across replicas. Returns
 * `{ ran: false }` immediately — without running `task` — when another holder
 * already owns the lock.
 *
 * Lock and unlock must happen on the SAME physical connection (advisory locks
 * are session-scoped), so a connection is reserved out of the pool for the
 * whole task; using the shared `db` would take the lock on one pooled
 * connection and lose it on the next statement.
 */
export async function tryWithAdvisoryLock<T>(
    key: number,
    task: () => Promise<T>
): Promise<{ ran: true; result: T } | { ran: false }> {
    const connection = await postgresDb.reserve();
    try {
        const [row] = await connection<{ locked: boolean }[]>`
            SELECT pg_try_advisory_lock(${key}) AS locked
        `;
        if (!row?.locked) {
            return { ran: false };
        }
        try {
            return { ran: true, result: await task() };
        } finally {
            await connection`SELECT pg_advisory_unlock(${key})`;
        }
    } finally {
        connection.release();
    }
}
