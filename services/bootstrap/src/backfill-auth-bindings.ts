import { frakChainIds } from "@frak-labs/app-essentials/blockchain";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import {
    authenticatorsTable,
    authenticatorWalletBindingsTable,
} from "../../backend/src/domain/auth/db/schema";

const BATCH_SIZE = 500;

/**
 * Seeds one active binding per configured Frak chain for every existing
 * authenticator that has a non-null `smart_wallet_address` but no binding yet.
 *
 * Idempotent — relies on the partial unique index
 * `(authenticator_id, chain_id) WHERE unlinked_at IS NULL` to skip rows that
 * already have an active binding. Safe to re-run on every deploy.
 *
 * Authenticators with a NULL `smart_wallet_address` (very old rows from
 * before the column existed) are SKIPPED here; they get back-filled lazily on
 * the next login via `AuthenticatorRepository.ensureActiveBindings`.
 */
export async function runAuthBindingBackfill(): Promise<void> {
    const url = process.env.LIBSQL_URL;
    if (!url) {
        console.log("[bootstrap:auth-bindings] LIBSQL_URL not set, skipping");
        return;
    }

    console.log(
        `[bootstrap:auth-bindings] Seeding bindings for chains [${frakChainIds.join(", ")}]`
    );

    const client = createClient({ url });
    const db = drizzle(client);

    const now = Math.floor(Date.now() / 1000);
    let offset = 0;
    let scanned = 0;
    let inserted = 0;
    let skippedNullWallet = 0;

    while (true) {
        const batch = await db
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
        scanned += batch.length;

        const rows = [];
        for (const auth of batch) {
            if (!auth.smartWalletAddress) {
                skippedNullWallet += 1;
                continue;
            }
            for (const chainId of frakChainIds) {
                rows.push({
                    authenticatorId: auth.id,
                    chainId,
                    smartWalletAddress: auth.smartWalletAddress,
                    email: auth.email ?? null,
                    createdAt: now,
                    reason: "initial" as const,
                });
            }
        }

        if (rows.length > 0) {
            const result = await db
                .insert(authenticatorWalletBindingsTable)
                .values(rows)
                .onConflictDoNothing()
                .returning({ id: authenticatorWalletBindingsTable.id });
            inserted += result.length;
        }

        offset += BATCH_SIZE;
    }

    client.close();

    console.log(
        `[bootstrap:auth-bindings] Complete. scanned=${scanned} inserted=${inserted} skippedNullWallet=${skippedNullWallet}`
    );
}
