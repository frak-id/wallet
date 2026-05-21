import { db } from "@backend-infrastructure";
import type { FrakChainId } from "@frak-labs/app-essentials/blockchain";
import { and, eq, isNull } from "drizzle-orm";
import { LRUCache } from "lru-cache";
import type { Address } from "viem";
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

/**
 * Wallet addresses are stored lowercased on the binding table to match the
 * normalisation used by `identity_nodes` (see `IdentityRepository.normalizeValue`).
 * That keeps the partial unique on `(authenticator_id, chain_id)` and the
 * by-wallet lookup index coherent regardless of which entry point inserted
 * the row.
 */
function normalizeWallet(address: Address): Address {
    return address.toLowerCase() as Address;
}

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
     * Every currently-active binding for a credential, ordered by chain id
     * (deterministic). Empty array when the credential has no bindings yet.
     */
    async getActiveBindings(
        credentialId: string,
        { tx }: { tx?: PgTx } = {}
    ): Promise<AuthenticatorWalletBindingSelect[]> {
        const runner: PgRunner = tx ?? db;
        return runner
            .select()
            .from(authenticatorWalletBindingsTable)
            .where(
                and(
                    eq(
                        authenticatorWalletBindingsTable.authenticatorId,
                        credentialId
                    ),
                    isNull(authenticatorWalletBindingsTable.unlinkedAt)
                )
            )
            .orderBy(authenticatorWalletBindingsTable.chainId);
    }

    /**
     * Resolve the credential currently bound to the given wallet on the given
     * chain. Returns only the credential id; the caller composes with
     * `AuthenticatorRepository.getByCredentialId` when the full credential
     * row is needed (the join crosses the libSQL ↔ postgres boundary).
     */
    async getActiveByWallet({
        chainId,
        smartWalletAddress,
        tx,
    }: {
        chainId: FrakChainId;
        smartWalletAddress: Address;
        tx?: PgTx;
    }): Promise<{ authenticatorId: string } | null> {
        const runner: PgRunner = tx ?? db;
        const [row] = await runner
            .select({
                authenticatorId:
                    authenticatorWalletBindingsTable.authenticatorId,
            })
            .from(authenticatorWalletBindingsTable)
            .where(
                and(
                    eq(
                        authenticatorWalletBindingsTable.smartWalletAddress,
                        normalizeWallet(smartWalletAddress)
                    ),
                    eq(authenticatorWalletBindingsTable.chainId, chainId),
                    isNull(authenticatorWalletBindingsTable.unlinkedAt)
                )
            )
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
                smartWalletAddress: normalizeWallet(smartWalletAddress),
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
     * Runs inside the caller's transaction when `tx` is provided so the
     * binding repoint commits atomically with the identity-graph merge ops.
     * When called without `tx`, opens its own short-lived transaction.
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
        const normalized = normalizeWallet(toSmartWalletAddress);

        const run = async (
            runner: PgRunner
        ): Promise<AuthenticatorWalletBindingSelect> => {
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
                .limit(1);

            if (existingRow) {
                await runner
                    .update(authenticatorWalletBindingsTable)
                    .set({ unlinkedAt: new Date() })
                    .where(
                        eq(authenticatorWalletBindingsTable.id, existingRow.id)
                    );
            }

            await runner
                .insert(authenticatorWalletBindingsTable)
                .values({
                    authenticatorId: credentialId,
                    chainId,
                    smartWalletAddress: normalized,
                    reason,
                })
                .onConflictDoNothing();

            const [freshRow] = await runner
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
            if (!freshRow) {
                throw new Error(
                    "repointBinding: failed to read the new active binding back"
                );
            }
            return freshRow;
        };

        const fresh = tx ? await run(tx) : await db.transaction(run);
        this.invalidateBinding(credentialId, chainId);
        return fresh;
    }
}
