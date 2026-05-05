import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

const MIGRATIONS_FOLDER = "./drizzle/libsql";

export async function runLibsqlMigrations(): Promise<void> {
    const url = process.env.LIBSQL_URL;
    if (!url) {
        console.log("[bootstrap:libsql] LIBSQL_URL not set, skipping");
        return;
    }

    console.log(`[bootstrap:libsql] Running libSQL migrations (url=${url})`);

    const client = createClient({ url });
    const db = drizzle(client);

    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    client.close();

    console.log("[bootstrap:libsql] libSQL migrations complete");
}
