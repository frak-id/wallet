import { frakChainIds } from "@frak-labs/app-essentials/blockchain";
import { type Client, createClient } from "@libsql/client";
import { and, eq, isNull } from "drizzle-orm";
import { drizzle as drizzleLibsql } from "drizzle-orm/libsql";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
    authenticatorsTable,
    authenticatorWalletBindingsTable,
} from "../../backend/src/domain/auth/db/schema";
import { identityNodesTable } from "../../backend/src/domain/identity/db/schema";

const BATCH_SIZE = 500;

type WalletAddress = `0x${string}`;

type AuthBatchRow = {
    id: string;
    smartWalletAddress: string | null;
    email: string | null;
};

type EmailMigrationOutcome =
    | "inserted"
    | "no-group"
    | "already-on-group"
    | "skip";

type BackfillStats = {
    scanned: number;
    bindingsInserted: number;
    emailNodesInserted: number;
    skippedNullWallet: number;
    skippedEmailNoGroup: number;
    skippedEmailAlreadyOnGroup: number;
};

/**
 * Seeds one active binding per configured Frak chain for every existing
 * authenticator that has a non-null `smart_wallet_address` but no binding yet,
 * and migrates the legacy `authenticators.email` value into a dedicated
 * postgres `identity_nodes` row keyed to the wallet's identity group.
 *
 * Bindings step is idempotent — relies on the partial unique index
 * `(authenticator_id, chain_id) WHERE unlinked_at IS NULL` to skip rows that
 * already have an active binding.
 *
 * Email step is idempotent — skips when the wallet's identity group already
 * holds an email node, regardless of value. The `identity_nodes` global
 * unique on `(identity_type, identity_value, merchant_id)` would also catch
 * exact duplicates, but the explicit per-group pre-check additionally guards
 * against inserting a second, different email onto a group that has already
 * been updated through the post-auth `POST /email` route.
 *
 * Authenticators with a NULL `smart_wallet_address` (very old rows from
 * before the column existed) are SKIPPED here; they get back-filled lazily on
 * the next login via `AuthenticatorRepository.ensureActiveBindings`. Their
 * email — if any — lands on the next bootstrap run once their wallet identity
 * group exists in postgres.
 */
export async function runAuthBindingBackfill(): Promise<void> {
    const libsqlUrl = process.env.LIBSQL_URL;
    if (!libsqlUrl) {
        console.log("[bootstrap:auth-bindings] LIBSQL_URL not set, skipping");
        return;
    }

    console.log(
        `[bootstrap:auth-bindings] Seeding bindings for chains [${frakChainIds.join(", ")}]`
    );

    const libsqlClient = createClient({ url: libsqlUrl });
    const libsqlDb = drizzleLibsql(libsqlClient);

    const pgClient = postgres(buildPostgresUrl(), { max: 1 });
    const pgDb = drizzlePg(pgClient);

    const stats: BackfillStats = {
        scanned: 0,
        bindingsInserted: 0,
        emailNodesInserted: 0,
        skippedNullWallet: 0,
        skippedEmailNoGroup: 0,
        skippedEmailAlreadyOnGroup: 0,
    };

    try {
        await processAllBatches({ libsqlClient, libsqlDb, pgDb, stats });
    } finally {
        libsqlClient.close();
        await pgClient.end();
    }

    console.log(
        `[bootstrap:auth-bindings] Complete. scanned=${stats.scanned} bindingsInserted=${stats.bindingsInserted} emailNodesInserted=${stats.emailNodesInserted} skippedNullWallet=${stats.skippedNullWallet} skippedEmailNoGroup=${stats.skippedEmailNoGroup} skippedEmailAlreadyOnGroup=${stats.skippedEmailAlreadyOnGroup}`
    );
}

async function processAllBatches({
    libsqlClient,
    libsqlDb,
    pgDb,
    stats,
}: {
    libsqlClient: Client;
    libsqlDb: ReturnType<typeof drizzleLibsql>;
    pgDb: ReturnType<typeof drizzlePg>;
    stats: BackfillStats;
}): Promise<void> {
    void libsqlClient; // ownership stays with caller
    const now = Math.floor(Date.now() / 1000);
    let offset = 0;
    while (true) {
        const batch: AuthBatchRow[] = await libsqlDb
            .select({
                id: authenticatorsTable.id,
                smartWalletAddress: authenticatorsTable.smartWalletAddress,
                email: authenticatorsTable.email,
            })
            .from(authenticatorsTable)
            .orderBy(authenticatorsTable.id)
            .limit(BATCH_SIZE)
            .offset(offset);

        if (batch.length === 0) break;
        stats.scanned += batch.length;

        stats.bindingsInserted += await seedBindingsForBatch({
            libsqlDb,
            batch,
            now,
            stats,
        });

        for (const auth of batch) {
            const outcome = await migrateEmailForRow({ pgDb, auth });
            if (outcome === "inserted") stats.emailNodesInserted += 1;
            else if (outcome === "no-group") stats.skippedEmailNoGroup += 1;
            else if (outcome === "already-on-group")
                stats.skippedEmailAlreadyOnGroup += 1;
        }

        offset += BATCH_SIZE;
    }
}

async function seedBindingsForBatch({
    libsqlDb,
    batch,
    now,
    stats,
}: {
    libsqlDb: ReturnType<typeof drizzleLibsql>;
    batch: AuthBatchRow[];
    now: number;
    stats: BackfillStats;
}): Promise<number> {
    const bindingRows: {
        authenticatorId: string;
        chainId: number;
        smartWalletAddress: WalletAddress;
        createdAt: number;
        reason: "initial";
    }[] = [];

    for (const auth of batch) {
        if (!auth.smartWalletAddress) {
            stats.skippedNullWallet += 1;
            continue;
        }
        for (const chainId of frakChainIds) {
            bindingRows.push({
                authenticatorId: auth.id,
                chainId,
                smartWalletAddress: auth.smartWalletAddress as WalletAddress,
                createdAt: now,
                reason: "initial",
            });
        }
    }

    if (bindingRows.length === 0) return 0;

    const result = await libsqlDb
        .insert(authenticatorWalletBindingsTable)
        .values(bindingRows)
        .onConflictDoNothing()
        .returning({ id: authenticatorWalletBindingsTable.id });
    return result.length;
}

/**
 * Migrate the legacy `authenticators.email` value onto the wallet's identity
 * group. Authoritative source post-refactor is the postgres `identity_nodes`
 * row, not the per-authenticator column.
 */
async function migrateEmailForRow({
    pgDb,
    auth,
}: {
    pgDb: ReturnType<typeof drizzlePg>;
    auth: AuthBatchRow;
}): Promise<EmailMigrationOutcome> {
    if (!auth.email || !auth.smartWalletAddress) return "skip";

    const normalizedWallet = auth.smartWalletAddress.toLowerCase();
    const normalizedEmail = auth.email.trim().toLowerCase();

    const [walletNode] = await pgDb
        .select({ groupId: identityNodesTable.groupId })
        .from(identityNodesTable)
        .where(
            and(
                eq(identityNodesTable.identityType, "wallet"),
                eq(identityNodesTable.identityValue, normalizedWallet),
                isNull(identityNodesTable.unlinkedAt)
            )
        )
        .limit(1);

    if (!walletNode) {
        // No identity group on this env yet — the wallet has never produced
        // an identity-bearing event in postgres. The next bootstrap run picks
        // it up once the group exists; in between the legacy column keeps
        // the data.
        return "no-group";
    }

    const [existingEmail] = await pgDb
        .select({ id: identityNodesTable.id })
        .from(identityNodesTable)
        .where(
            and(
                eq(identityNodesTable.groupId, walletNode.groupId),
                eq(identityNodesTable.identityType, "email"),
                isNull(identityNodesTable.unlinkedAt)
            )
        )
        .limit(1);

    if (existingEmail) {
        // The group already has an email node (set either by a previous
        // back-fill pass or by the post-auth route). Skip rather than risk
        // attaching a second, different value — the running app is the
        // source of truth past the first migration.
        return "already-on-group";
    }

    const inserted = await pgDb
        .insert(identityNodesTable)
        .values({
            groupId: walletNode.groupId,
            identityType: "email",
            identityValue: normalizedEmail,
        })
        .onConflictDoNothing()
        .returning({ id: identityNodesTable.id });

    return inserted.length > 0 ? "inserted" : "skip";
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
