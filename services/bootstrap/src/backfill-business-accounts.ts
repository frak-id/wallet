import { sql } from "drizzle-orm";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { businessAccountsTable } from "../../backend/src/domain/business-auth/db/schema";

type WalletAddress = `0x${string}`;

type BackfillStats = {
    walletsScanned: number;
    accountsCreated: number;
    merchantsBackfilled: number;
    adminsBackfilled: number;
};

/**
 * Phase-0 eager migration (business-walletless-auth design doc §5):
 * every wallet that owns or administers a merchant gets a `business_account`
 * with its `wallet_address` column set, and `merchants.owner_account_id` /
 * `merchant_admins.account_id` are backfilled from those accounts.
 *
 * The merchant tables are addressed with raw SQL (not the backend Drizzle
 * schema) on purpose: `domain/merchant/db/schema.ts` drags in API-layer type
 * imports (`@backend-utils`) that bootstrap's tsconfig should not resolve.
 * The business-auth schema is import-clean, so typed inserts are used there.
 *
 * Idempotent — wallets that already have an account (`wallet_address` set)
 * are skipped (partial unique index `business_accounts_wallet_idx`), and the
 * UPDATE statements only touch rows whose account column is still NULL.
 *
 * Gracefully no-ops when the `business_accounts` table (or the new merchant
 * columns) does not exist yet — those migrations are human-written and may
 * land after this code deploys.
 */
export async function runBusinessAccountBackfill(): Promise<void> {
    const pgClient = postgres(buildPostgresUrl(), { max: 1 });
    const pgDb = drizzlePg(pgClient);

    try {
        const ready = await isSchemaReady(pgClient);
        if (!ready) {
            console.log(
                "[bootstrap:business-accounts] business_accounts table or merchant account columns missing (migration not applied yet), skipping"
            );
            return;
        }

        const stats: BackfillStats = {
            walletsScanned: 0,
            accountsCreated: 0,
            merchantsBackfilled: 0,
            adminsBackfilled: 0,
        };

        await createAccountsForWallets(pgDb, stats);
        await backfillOwnerColumns(pgDb, stats);

        console.log(
            `[bootstrap:business-accounts] Complete. walletsScanned=${stats.walletsScanned} accountsCreated=${stats.accountsCreated} merchantsBackfilled=${stats.merchantsBackfilled} adminsBackfilled=${stats.adminsBackfilled}`
        );
    } finally {
        await pgClient.end();
    }
}

/** Both the new table and the new merchant columns must exist. */
async function isSchemaReady(pgClient: postgres.Sql): Promise<boolean> {
    const schemaName = process.env.POSTGRES_SCHEMA || "public";
    const [row] = await pgClient<{ ready: boolean }[]>`
        SELECT
            to_regclass(${`${schemaName}.business_accounts`}) IS NOT NULL
            AND EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = ${schemaName}
                  AND table_name = 'merchants'
                  AND column_name = 'owner_account_id'
            ) AS ready
    `;
    return row?.ready === true;
}

/**
 * Distinct wallets from merchants.owner_wallet + merchant_admins.wallet that
 * do not yet have a business account; create one (with wallet_address set)
 * for each.
 */
async function createAccountsForWallets(
    pgDb: ReturnType<typeof drizzlePg>,
    stats: BackfillStats
): Promise<void> {
    const rows = await pgDb.execute<{ wallet: unknown }>(sql`
        SELECT DISTINCT wallet FROM (
            SELECT owner_wallet AS wallet FROM merchants
            WHERE owner_wallet IS NOT NULL
            UNION
            SELECT wallet FROM merchant_admins
            WHERE wallet IS NOT NULL
        ) wallets
        WHERE NOT EXISTS (
            SELECT 1 FROM business_accounts a
            WHERE a.wallet_address = wallets.wallet
        )
    `);

    const wallets = [...rows].map((r) => normalizeWallet(r.wallet));
    stats.walletsScanned = wallets.length;

    for (const wallet of wallets) {
        // Sequential: the backfill runs once and the volume (merchant
        // owners/admins) is small; correctness over speed. The unique index
        // on wallet_address makes a lost race against a concurrent login
        // upsert a no-op insert rather than a duplicate account.
        const inserted = await pgDb
            .insert(businessAccountsTable)
            .values({ walletAddress: wallet })
            .onConflictDoNothing()
            .returning({ id: businessAccountsTable.id });

        if (inserted.length > 0) {
            stats.accountsCreated += 1;
        }
    }
}

/** Backfill owner_account_id / account_id from the business accounts. */
async function backfillOwnerColumns(
    pgDb: ReturnType<typeof drizzlePg>,
    stats: BackfillStats
): Promise<void> {
    const merchantsResult = await pgDb.execute(sql`
        UPDATE merchants m
        SET owner_account_id = a.id
        FROM business_accounts a
        WHERE m.owner_account_id IS NULL
          AND m.owner_wallet IS NOT NULL
          AND a.wallet_address = m.owner_wallet
    `);
    stats.merchantsBackfilled = merchantsResult.count ?? 0;

    const adminsResult = await pgDb.execute(sql`
        UPDATE merchant_admins ma
        SET account_id = a.id
        FROM business_accounts a
        WHERE ma.account_id IS NULL
          AND ma.wallet IS NOT NULL
          AND a.wallet_address = ma.wallet
    `);
    stats.adminsBackfilled = adminsResult.count ?? 0;
}

/** postgres.js returns bytea as Buffer/Uint8Array; normalise to 0x-hex. */
function normalizeWallet(value: unknown): WalletAddress {
    if (typeof value === "string") {
        return (value.startsWith("0x") ? value : `0x${value}`) as WalletAddress;
    }
    const bytes = value as Uint8Array;
    return `0x${Buffer.from(bytes).toString("hex")}` as WalletAddress;
}

function buildPostgresUrl(): string {
    const host = process.env.POSTGRES_HOST ?? "";
    const port = process.env.POSTGRES_PORT ?? "5432";
    const database = process.env.POSTGRES_DB ?? "";
    const user = process.env.POSTGRES_USER ?? "";
    const password = process.env.POSTGRES_PASSWORD ?? "";
    const schemaName = process.env.POSTGRES_SCHEMA || "public";
    return `postgresql://${user}:${password}@${host}:${port}/${database}?search_path=${schemaName}`;
}
