import "@shopify/shopify-api/adapters/node";
import { parseArgs } from "node:util";
import { shopifyApi } from "@shopify/shopify-api";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { drizzleDb } from "../app/db.server";
import { apiVersion } from "../app/shopify.server";
import { DrizzleSessionStorageAdapter } from "../db/adapter/sessionAdapter";
import { sessionTable } from "../db/schema/sessionTable";
import { migrateOfflineSessions } from "./expiringTokenMigration";

/**
 * Swaps every stored non-expiring offline token for an expiring pair
 * (Shopify's "migrate all installations at once"). Dry run unless --apply.
 */
const { values } = parseArgs({ options: { apply: { type: "boolean" } } });

const appUrl = process.env.SHOPIFY_APP_URL;
if (
    !process.env.SHOPIFY_API_KEY ||
    !process.env.SHOPIFY_API_SECRET ||
    !appUrl
) {
    throw new Error(
        "SHOPIFY_API_KEY, SHOPIFY_API_SECRET and SHOPIFY_APP_URL are required"
    );
}

const api = shopifyApi({
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET,
    apiVersion,
    hostName: new URL(appUrl).host,
    isEmbeddedApp: true,
});

const sessions = await drizzleDb
    .select({ shop: sessionTable.shop, accessToken: sessionTable.accessToken })
    .from(sessionTable)
    .where(
        and(
            eq(sessionTable.isOnline, false),
            isNull(sessionTable.expires),
            isNotNull(sessionTable.accessToken)
        )
    );
const candidates = sessions.flatMap(({ shop, accessToken }) =>
    accessToken ? [{ shop, accessToken }] : []
);

console.log(`${candidates.length} non-expiring offline session(s)`);
for (const { shop } of candidates) console.log(`  ${shop}`);

if (!values.apply) {
    console.log("Dry run. Rerun with --apply to exchange them.");
    process.exit(0);
}

const storage = new DrizzleSessionStorageAdapter(drizzleDb, sessionTable);
const results = await migrateOfflineSessions(candidates, {
    exchange: async ({ shop, accessToken }) =>
        (
            await api.auth.migrateToExpiringToken({
                shop,
                nonExpiringOfflineAccessToken: accessToken,
            })
        ).session,
    store: (session) => storage.storeSession(session),
});

const failed = results.filter((result) => !result.ok);
for (const result of failed) console.error(`  ${result.shop}: ${result.error}`);
console.log(
    `${results.length - failed.length} migrated, ${failed.length} failed`
);
process.exit(failed.length ? 1 : 0);
