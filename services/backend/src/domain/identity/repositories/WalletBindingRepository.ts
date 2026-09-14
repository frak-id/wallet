import { db, type PgRunner, type PgTx } from "@backend-infrastructure";
import type { FrakChainId } from "@frak-labs/app-essentials/blockchain";
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { LRUCache } from "lru-cache";
import { type Address, isAddressEqual } from "viem";
import {
    type AuthenticatorWalletBindingSelect,
    authenticatorWalletBindingsTable,
    type BindingReason,
} from "../db/schema";

// Methods accept an optional tx so callers (e.g. the merge orchestrator) can
// compose binding writes with other identity-domain writes in one transaction.

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
     * Seed the initial binding for a credential on the given chain (register,
     * and the lazy back-fill on login). Idempotent via `ON CONFLICT DO NOTHING`
     * on the partial unique index, but it does NOT detect divergence: when the
     * active binding was repointed by a merge, the conflict-skip silently keeps
     * it. Only call during register or against a confirmed-empty binding.
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
     * Unlink the active binding for `(credentialId, chainId)` and insert a new
     * active row for `toSmartWalletAddress`. Idempotent: an active row already
     * pointing there short-circuits, so merge retries never churn the history
     * table. A `SELECT ... FOR UPDATE` serialises concurrent repoints. Runs in
     * the caller's `tx` when given, otherwise opens its own transaction.
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
        // Evicting inside the caller's transaction window leaves a narrow race
        // where a concurrent reader repopulates the cache from pre-commit
        // state; the 60s TTL bounds that staleness.
        this.invalidateBinding(credentialId, chainId);
        return fresh;
    }
}
