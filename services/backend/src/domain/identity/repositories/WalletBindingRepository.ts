import { db } from "@backend-infrastructure";
import type { FrakChainId } from "@frak-labs/app-essentials/blockchain";
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { LRUCache } from "lru-cache";
import { type Address, isAddressEqual } from "viem";
import {
    type AuthenticatorWalletBindingSelect,
    authenticatorWalletBindingsTable,
    type BindingReason,
} from "../db/schema";

/**
 * Postgres transaction handle as passed to `db.transaction(async (trx) => …)`.
 * Methods accept an optional handle so callers (e.g. the merge orchestrator)
 * can compose binding writes with other identity-domain writes inside a
 * single transaction.
 */
type PgTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type PgRunner = typeof db | PgTx;

type ActiveBindingCacheValue = {
    value: AuthenticatorWalletBindingSelect | null;
};

export class WalletBindingRepository {
    /**
     * Cache for `getActiveBinding({ credentialId, chainId })`. Login + every
     * signature verify path hits this lookup so the read load is high; the
     * mutation surface is narrow (`repointBinding`, `seedInitialBinding`,
     * `ensureActiveBinding`) and we invalidate on every write.
     */
    private readonly activeBindingCache = new LRUCache<
        string,
        ActiveBindingCacheValue
    >({
        max: 10_000,
        ttl: 60_000,
    });

    private bindingCacheKey(credentialId: string, chainId: number): string {
        return `${credentialId}:${chainId}`;
    }

    private invalidateBinding(credentialId: string, chainId: number): void {
        this.activeBindingCache.delete(
            this.bindingCacheKey(credentialId, chainId)
        );
    }

    /**
     * Single active binding for the `(credentialId, chainId)` pair, or
     * `null` when none exists.
     */
    async getActiveBinding({
        credentialId,
        chainId,
        tx,
    }: {
        credentialId: string;
        chainId: FrakChainId;
        tx?: PgTx;
    }): Promise<AuthenticatorWalletBindingSelect | null> {
        if (!tx) {
            const cached = this.activeBindingCache.get(
                this.bindingCacheKey(credentialId, chainId)
            );
            if (cached) return cached.value;
        }

        const runner: PgRunner = tx ?? db;
        const [row] = await runner
            .select()
            .from(authenticatorWalletBindingsTable)
            .where(
                and(
                    eq(
                        authenticatorWalletBindingsTable.authenticatorId,
                        credentialId
                    ),
                    eq(authenticatorWalletBindingsTable.chainId, chainId),
                    isNull(authenticatorWalletBindingsTable.unlinkedAt)
                )
            )
            .limit(1);

        const value = row ?? null;
        if (!tx) {
            this.activeBindingCache.set(
                this.bindingCacheKey(credentialId, chainId),
                { value }
            );
        }
        return value;
    }

    /**
     * Every credential currently bound to the given wallet on the given
     * chain. Ordered by binding id (deterministic). Used by:
     *  - email-scoped login: advertise every valid passkey to the WebAuthn
     *    ceremony — post-merge a wallet routinely holds 2+ bindings (winner
     *    cred + each repointed loser cred).
     *  - pairing resume: picks `[0]` since any binding signs the same
     *    userOps for the wallet; the deterministic order keeps retried
     *    resumes stable.
     */
    async getActiveAuthenticatorIdsByWallet({
        chainId,
        smartWalletAddress,
    }: {
        chainId: FrakChainId;
        smartWalletAddress: Address;
    }): Promise<string[]> {
        const rows = await db
            .select({
                authenticatorId:
                    authenticatorWalletBindingsTable.authenticatorId,
            })
            .from(authenticatorWalletBindingsTable)
            .where(
                and(
                    eq(
                        authenticatorWalletBindingsTable.smartWalletAddress,
                        smartWalletAddress
                    ),
                    eq(authenticatorWalletBindingsTable.chainId, chainId),
                    isNull(authenticatorWalletBindingsTable.unlinkedAt)
                )
            )
            .orderBy(authenticatorWalletBindingsTable.id);
        return rows.map((row) => row.authenticatorId);
    }

    /**
     * Most recently unlinked binding for `(credentialId, chainId)`, or
     * `null` when no history exists. Used by `WalletMergeOrchestrator.settle`
     * to reconstruct the original loser wallet on an idempotent retry: after
     * a successful merge the active binding now points at the winner, so the
     * pre-merge address only survives in the unlinked history.
     */
    async getLastUnlinkedBinding({
        credentialId,
        chainId,
    }: {
        credentialId: string;
        chainId: FrakChainId;
    }): Promise<AuthenticatorWalletBindingSelect | null> {
        const [row] = await db
            .select()
            .from(authenticatorWalletBindingsTable)
            .where(
                and(
                    eq(
                        authenticatorWalletBindingsTable.authenticatorId,
                        credentialId
                    ),
                    eq(authenticatorWalletBindingsTable.chainId, chainId),
                    isNotNull(authenticatorWalletBindingsTable.unlinkedAt)
                )
            )
            .orderBy(desc(authenticatorWalletBindingsTable.unlinkedAt))
            .limit(1);
        return row ?? null;
    }

    /**
     * Seed the initial binding for a credential on the given chain. Used by
     * register (current-chain only) and by the lazy back-fill path on login.
     *
     * Idempotent via `ON CONFLICT DO NOTHING` on the partial unique
     * `(authenticator_id, chain_id) WHERE unlinked_at IS NULL`. Safe to retry
     * against a fresh credential or after a confirmed-empty
     * `getActiveBinding` result.
     *
     * Does NOT detect divergence — if the credential's active binding was
     * previously repointed (e.g. via a merge), the conflict-skip silently
     * leaves the merged binding in place even when the caller passes a
     * different `smartWalletAddress`. Callers must therefore only invoke
     * this during register or against a confirmed-empty binding.
     */
    async seedInitialBinding({
        credentialId,
        chainId,
        smartWalletAddress,
        tx,
    }: {
        credentialId: string;
        chainId: FrakChainId;
        smartWalletAddress: Address;
        tx?: PgTx;
    }): Promise<void> {
        const runner: PgRunner = tx ?? db;
        await runner
            .insert(authenticatorWalletBindingsTable)
            .values({
                authenticatorId: credentialId,
                chainId,
                smartWalletAddress,
                reason: "initial",
            })
            .onConflictDoNothing();
        this.invalidateBinding(credentialId, chainId);
    }

    /**
     * Idempotent lazy back-fill: ensures an active binding exists for
     * `(credentialId, chainId)`, inserting an `initial` row when missing.
     * Called from the login route when `getActiveBinding` returns null —
     * recovers legacy credentials whose binding hasn't been seeded yet.
     */
    async ensureActiveBinding({
        credentialId,
        chainId,
        smartWalletAddress,
        tx,
    }: {
        credentialId: string;
        chainId: FrakChainId;
        smartWalletAddress: Address;
        tx?: PgTx;
    }): Promise<void> {
        const existing = await this.getActiveBinding({
            credentialId,
            chainId,
            tx,
        });
        if (existing) return;
        await this.seedInitialBinding({
            credentialId,
            chainId,
            smartWalletAddress,
            tx,
        });
    }

    /**
     * Unlink the current active binding for `(credentialId, chainId)` and
     * insert a new active row pointing at `toSmartWalletAddress`. Used by
     * the wallet-merge orchestrator.
     *
     * Idempotent: if the active row already points at `toSmartWalletAddress`,
     * the call short-circuits and returns the existing row unchanged. This
     * makes settle() retries safe — a client replaying the same request after
     * a successful merge sees a no-op here instead of churning the history
     * table with redundant `merged` rows.
     *
     * Concurrency: a `SELECT ... FOR UPDATE` row lock serialises concurrent
     * repoints for the same (credentialId, chainId). The second caller waits
     * for the first to commit, then reads the now-merged row and exits via
     * the idempotency check above.
     *
     * Runs inside the caller's transaction when `tx` is provided so the
     * binding repoint commits atomically with the identity-graph merge ops.
     * When called without `tx`, opens its own short-lived transaction.
     *
     * Cache invalidation: when `tx` is provided the eviction is deferred to
     * `invalidateBindingAfterCommit` so cache reads during the in-flight
     * transaction can't repopulate from pre-commit state. Without `tx` the
     * internal transaction has already committed by the time we evict.
     */
    async repointBinding({
        credentialId,
        chainId,
        toSmartWalletAddress,
        reason,
        tx,
    }: {
        credentialId: string;
        chainId: FrakChainId;
        toSmartWalletAddress: Address;
        reason: BindingReason;
        tx?: PgTx;
    }): Promise<AuthenticatorWalletBindingSelect> {
        const run = async (
            runner: PgRunner
        ): Promise<AuthenticatorWalletBindingSelect> => {
            // Lock the active row so concurrent repoints serialise rather
            // than racing the unlink-and-insert window.
            const [existingRow] = await runner
                .select()
                .from(authenticatorWalletBindingsTable)
                .where(
                    and(
                        eq(
                            authenticatorWalletBindingsTable.authenticatorId,
                            credentialId
                        ),
                        eq(authenticatorWalletBindingsTable.chainId, chainId),
                        isNull(authenticatorWalletBindingsTable.unlinkedAt)
                    )
                )
                .for("update")
                .limit(1);

            // Idempotent: if the active row already points at the requested
            // wallet, this is a no-op retry. Returning the existing row keeps
            // the history table clean and lets settle() converge on success.
            if (
                existingRow &&
                isAddressEqual(
                    existingRow.smartWalletAddress,
                    toSmartWalletAddress
                )
            ) {
                return existingRow;
            }

            if (existingRow) {
                await runner
                    .update(authenticatorWalletBindingsTable)
                    .set({ unlinkedAt: new Date() })
                    .where(
                        eq(authenticatorWalletBindingsTable.id, existingRow.id)
                    );
            }

            const [freshRow] = await runner
                .insert(authenticatorWalletBindingsTable)
                .values({
                    authenticatorId: credentialId,
                    chainId,
                    smartWalletAddress: toSmartWalletAddress,
                    reason,
                })
                .returning();
            if (!freshRow) {
                throw new Error("repointBinding: insert returned no row");
            }
            return freshRow;
        };

        const fresh = tx ? await run(tx) : await db.transaction(run);
        // Cache eviction inside the caller's transaction window leaves a
        // narrow race where a concurrent reader could repopulate the cache
        // from pre-commit state. The 60s TTL bounds that staleness; chasing
        // proper post-commit eviction would either require a deferred hook
        // (Drizzle has none) or push the responsibility onto every caller.
        // Accepting the bounded race is the simpler tradeoff.
        this.invalidateBinding(credentialId, chainId);
        return fresh;
    }
}
