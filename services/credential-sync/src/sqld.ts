import { createClient } from "@libsql/client";
import { inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const LIBSQL_URL = process.env.LIBSQL_URL;

export const authenticatorsTable = sqliteTable("authenticators", {
    id: text("id").primaryKey(),
    smartWalletAddress: text("smart_wallet_address"),
    userAgent: text("user_agent").notNull(),
    publicKeyX: text("public_key_x").notNull(),
    publicKeyY: text("public_key_y").notNull(),
    credentialPublicKey: text("credential_public_key").notNull(),
    counter: integer("counter").notNull(),
    credentialDeviceType: text("credential_device_type").notNull(),
    credentialBackedUp: integer("credential_backed_up", {
        mode: "boolean",
    }).notNull(),
    transports: text("transports", { mode: "json" }).$type<string[]>(),
});

export type SqldRow = typeof authenticatorsTable.$inferSelect;

function getDb() {
    if (!LIBSQL_URL) {
        throw new Error("LIBSQL_URL is required");
    }
    const client = createClient({ url: LIBSQL_URL });
    return drizzle(client);
}

const ID_BATCH_SIZE = 500;

export async function fetchSqldIds(): Promise<Set<string>> {
    const db = getDb();
    const ids = new Set<string>();
    let offset = 0;

    while (true) {
        const rows = await db
            .select({ id: authenticatorsTable.id })
            .from(authenticatorsTable)
            .limit(ID_BATCH_SIZE)
            .offset(offset);

        for (const r of rows) {
            ids.add(r.id);
        }

        if (rows.length < ID_BATCH_SIZE) break;
        offset += ID_BATCH_SIZE;
    }

    return ids;
}

export async function fetchSqldByIds(ids: string[]): Promise<SqldRow[]> {
    if (ids.length === 0) return [];
    const db = getDb();
    return db
        .select()
        .from(authenticatorsTable)
        .where(inArray(authenticatorsTable.id, ids));
}

export async function insertIntoSqld(rows: SqldRow[]): Promise<number> {
    if (rows.length === 0) return 0;
    const db = getDb();
    // SQLite INSERT OR IGNORE skips existing PKs
    await db.insert(authenticatorsTable).values(rows).onConflictDoNothing();
    return rows.length;
}
