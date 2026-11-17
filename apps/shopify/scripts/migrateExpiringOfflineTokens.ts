import "@shopify/shopify-api/adapters/node";
import { parseArgs } from "node:util";
import { shopifyApi } from "@shopify/shopify-api";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { drizzleDb } from "../app/db.server";
import { apiVersion } from "../app/shopify.server";
import { DrizzleSessionStorageAdapter } from "../db/adapter/sessionAdapter";
import { sessionTable } from "../db/schema/sessionTable";
import {
    type MigrationResult,
    migrateOfflineSessions,
} from "./expiringTokenMigration";

/**
 * Swaps stored non-expiring offline tokens for expiring pairs (Shopify's
 * "migrate all installations at once"). Dry run unless --apply. --shop
 * (repeatable) limits the run; --clear-dead deletes rows whose token Shopify refuses.
 */
const { values } = parseArgs({
    options: {
        apply: { type: "boolean" },
        "clear-dead": { type: "boolean" },
        shop: { type: "string", multiple: true },
    },
});
if (values["clear-dead"] && !values.apply) {
    throw new Error("--clear-dead only acts together with --apply");
}

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

const nonExpiringOffline = and(
    eq(sessionTable.isOnline, false),
    isNull(sessionTable.expires),
    isNotNull(sessionTable.accessToken)
);
const requestedShops = values.shop;
const sessions = await drizzleDb
    .select({
        id: sessionTable.id,
        shop: sessionTable.shop,
        accessToken: sessionTable.accessToken,
    })
    .from(sessionTable)
    .where(
        and(
            nonExpiringOffline,
            requestedShops
                ? inArray(sessionTable.shop, requestedShops)
                : undefined
        )
    );
const candidates = sessions.flatMap(({ id, shop, accessToken }) =>
    accessToken ? [{ id, shop, accessToken }] : []
);

for (const shop of requestedShops ?? []) {
    if (!candidates.some((candidate) => candidate.shop === shop)) {
        console.log(`  skipped ${shop}: no non-expiring offline session`);
    }
}
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
    clear: values["clear-dead"]
        ? async ({ id }) => {
              await drizzleDb
                  .delete(sessionTable)
                  .where(and(eq(sessionTable.id, id), nonExpiringOffline));
          }
        : undefined,
});

const HINTS: Partial<Record<MigrationResult["status"], string>> = {
    dead: "Shopify refused these tokens. --apply --clear-dead deletes their rows; the merchant re-authenticates on the next app open.",
    unsaved:
        "Exchanged but not stored. Rerun within 7 days: Shopify returns the same pair.",
    failed: "Transient or unknown. Safe to rerun.",
};

for (const result of results) {
    const detail = "error" in result ? `  ${result.error}` : "";
    console.log(`  ${result.status.padEnd(8)} ${result.shop}${detail}`);
}
const statuses = ["migrated", "cleared", "dead", "failed", "unsaved"] as const;
const count = (status: MigrationResult["status"]) =>
    results.filter((result) => result.status === status).length;
console.log(statuses.map((status) => `${count(status)} ${status}`).join(", "));
for (const status of statuses) {
    const hint = HINTS[status];
    if (hint && count(status)) console.log(`${status}: ${hint}`);
}
process.exit(results.some((result) => "error" in result) ? 1 : 0);
