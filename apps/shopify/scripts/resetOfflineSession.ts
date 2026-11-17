import { parseArgs } from "node:util";
import { and, eq, inArray } from "drizzle-orm";
import { drizzleDb } from "../app/db.server";
import { sessionTable } from "../db/schema/sessionTable";

/**
 * Deletes the offline session of each --shop, for a shop stuck on a token
 * Shopify rejects. The merchant's next app open exchanges a fresh token, and
 * webhooks for that shop run without a session until then. Dry run unless --apply.
 */
const { values } = parseArgs({
    options: {
        apply: { type: "boolean" },
        shop: { type: "string", multiple: true },
    },
});
const shops = values.shop ?? [];
if (!shops.length) {
    throw new Error("Pass at least one --shop <name>.myshopify.com");
}

const offlineSessionsOfShops = and(
    eq(sessionTable.isOnline, false),
    inArray(sessionTable.shop, shops)
);
const rows = await drizzleDb
    .select({
        shop: sessionTable.shop,
        expires: sessionTable.expires,
        refreshTokenExpires: sessionTable.refreshTokenExpires,
    })
    .from(sessionTable)
    .where(offlineSessionsOfShops);

for (const shop of shops) {
    const row = rows.find((candidate) => candidate.shop === shop);
    if (!row) {
        console.log(`  ${shop}: no offline session`);
        continue;
    }
    const state = row.expires
        ? `expiring, access until ${row.expires.toISOString()}, refresh until ${row.refreshTokenExpires?.toISOString() ?? "none"}`
        : "non-expiring";
    console.log(`  ${shop}: ${state}`);
}

if (!values.apply) {
    console.log("Dry run. Rerun with --apply to delete them.");
    process.exit(0);
}

await drizzleDb.delete(sessionTable).where(offlineSessionsOfShops);
console.log(
    `Deleted ${rows.length} offline session(s). Ask the merchant to reopen the app.`
);
process.exit(0);
