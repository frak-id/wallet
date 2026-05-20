import { getLibsqlDb } from "@backend-infrastructure";
import {
    type FrakChainId,
    frakChainIds,
} from "@frak-labs/app-essentials/blockchain";
import { and, eq, isNull } from "drizzle-orm";
import type { Address } from "viem";
import {
    type AuthenticatorBindingSelect,
    authenticatorsTable,
    authenticatorWalletBindingsTable,
    type BindingReason,
} from "../db/schema";
import type { AuthenticatorDocument } from "../models/dto/AuthenticatorDocument";

/**
 * libSQL transaction handle as passed to `db.transaction(async (tx) => …)`.
 * Extracted once here so private helpers can be invoked inside a caller's
 * transaction without each call site having to repeat the parameter type.
 */
type LibsqlTx = Parameters<
    Parameters<ReturnType<typeof getLibsqlDb>["transaction"]>[0]
>[0];

export class AuthenticatorRepository {
    /**
     * Get an authenticator by credential id. Pure credential lookup — the
     * returned `smartWalletAddress` is the legacy denormalised value from the
     * `authenticators` row. Callers that need chain-scoped answers should use
     * `getActiveBinding(s)`.
     */
    public async getByCredentialId(
        credentialId: string
    ): Promise<AuthenticatorDocument | null> {
        const db = getLibsqlDb();
        const [row] = await db
            .select()
            .from(authenticatorsTable)
            .where(eq(authenticatorsTable.id, credentialId));

        if (!row) return null;

        return {
            _id: row.id,
            smartWalletAddress:
                row.smartWalletAddress as AuthenticatorDocument["smartWalletAddress"],
            userAgent: row.userAgent,
            publicKey: {
                x: row.publicKeyX as AuthenticatorDocument["publicKey"]["x"],
                y: row.publicKeyY as AuthenticatorDocument["publicKey"]["y"],
            },
            credentialPublicKey: row.credentialPublicKey,
            counter: row.counter,
            credentialDeviceType:
                row.credentialDeviceType as AuthenticatorDocument["credentialDeviceType"],
            credentialBackedUp: row.credentialBackedUp,
            transports: row.transports as AuthenticatorDocument["transports"],
        };
    }

    /**
     * Get the credential currently bound to the given wallet on the given
     * chain. Falls back to the legacy `authenticators.smart_wallet_address`
     * column when no binding row exists yet (pre-back-fill rows).
     */
    public async getByActiveWallet({
        chainId,
        smartWalletAddress,
    }: {
        chainId: FrakChainId;
        smartWalletAddress: Address;
    }): Promise<AuthenticatorDocument | null> {
        const db = getLibsqlDb();

        const [bindingRow] = await db
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
            .limit(1);
        if (bindingRow) {
            return this.getByCredentialId(bindingRow.authenticatorId);
        }

        const [row] = await db
            .select()
            .from(authenticatorsTable)
            .where(
                eq(authenticatorsTable.smartWalletAddress, smartWalletAddress)
            )
            .limit(1);

        if (!row) return null;

        return {
            _id: row.id,
            smartWalletAddress:
                row.smartWalletAddress as AuthenticatorDocument["smartWalletAddress"],
            userAgent: row.userAgent,
            publicKey: {
                x: row.publicKeyX as AuthenticatorDocument["publicKey"]["x"],
                y: row.publicKeyY as AuthenticatorDocument["publicKey"]["y"],
            },
            credentialPublicKey: row.credentialPublicKey,
            counter: row.counter,
            credentialDeviceType:
                row.credentialDeviceType as AuthenticatorDocument["credentialDeviceType"],
            credentialBackedUp: row.credentialBackedUp,
            transports: row.transports as AuthenticatorDocument["transports"],
        };
    }

    /**
     * Idempotent insert: if a row with the same credential id already exists,
     * returns it instead of throwing. Lets clients safely retry registration
     * after a transient backend failure without producing duplicates or 500s.
     *
     * Also creates one active binding per configured Frak chain. The legacy
     * row insert and the binding inserts run inside a single libSQL
     * transaction so a retry can never observe a credential without its
     * bindings (or vice-versa).
     */
    public async createAuthenticator(
        authenticator: AuthenticatorDocument
    ): Promise<{ created: boolean; document: AuthenticatorDocument }> {
        const db = getLibsqlDb();
        const inserted = await db.transaction(async (tx) => {
            const insertedRows = await tx
                .insert(authenticatorsTable)
                .values({
                    id: authenticator._id,
                    smartWalletAddress: authenticator.smartWalletAddress,
                    userAgent: authenticator.userAgent,
                    publicKeyX: authenticator.publicKey.x,
                    publicKeyY: authenticator.publicKey.y,
                    credentialPublicKey: authenticator.credentialPublicKey,
                    counter: authenticator.counter,
                    credentialDeviceType: authenticator.credentialDeviceType,
                    credentialBackedUp: authenticator.credentialBackedUp,
                    transports: authenticator.transports,
                })
                .onConflictDoNothing()
                .returning();

            if (authenticator.smartWalletAddress) {
                await this.seedInitialBindings(tx, {
                    credentialId: authenticator._id,
                    smartWalletAddress: authenticator.smartWalletAddress,
                });
            }

            return insertedRows;
        });

        if (inserted.length > 0) {
            return { created: true, document: authenticator };
        }

        const existingDoc = await this.getByCredentialId(authenticator._id);
        if (!existingDoc) {
            throw new Error(
                "Authenticator insert reported conflict but row could not be retrieved"
            );
        }
        return { created: false, document: existingDoc };
    }

    /**
     * Every currently-active binding for a credential, ordered by chain id
     * (deterministic). Empty array if the credential has no bindings yet
     * (legacy row still pending back-fill).
     */
    public async getActiveBindings(
        credentialId: string
    ): Promise<AuthenticatorBindingSelect[]> {
        const db = getLibsqlDb();
        const rows = await db
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
        return rows;
    }

    /**
     * Single active binding for the (credential, chain) pair. Null when no
     * active binding exists on that chain.
     */
    public async getActiveBinding({
        credentialId,
        chainId,
    }: {
        credentialId: string;
        chainId: FrakChainId;
    }): Promise<AuthenticatorBindingSelect | null> {
        const db = getLibsqlDb();
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
                    isNull(authenticatorWalletBindingsTable.unlinkedAt)
                )
            )
            .limit(1);
        return row ?? null;
    }

    /**
     * Unlink the current active binding for `(credentialId, chainId)` and
     * insert a new active binding pointing at `toSmartWalletAddress`. Used by
     * the merge orchestrator.
     *
     * Also updates the legacy `authenticators.smart_wallet_address` column so
     * dual-write consumers stay in sync.
     *
     * All four statements (read existing, stamp `unlinked_at`, insert new
     * active binding, update legacy column) run inside a single libSQL
     * transaction so a crash mid-way can never strand the credential without
     * an active binding.
     */
    public async repointBinding({
        credentialId,
        chainId,
        toSmartWalletAddress,
        reason,
    }: {
        credentialId: string;
        chainId: FrakChainId;
        toSmartWalletAddress: Address;
        reason: BindingReason;
    }): Promise<AuthenticatorBindingSelect> {
        const db = getLibsqlDb();
        const now = nowSeconds();

        return db.transaction(async (tx) => {
            const [existingRow] = await tx
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
                await tx
                    .update(authenticatorWalletBindingsTable)
                    .set({ unlinkedAt: now })
                    .where(
                        eq(authenticatorWalletBindingsTable.id, existingRow.id)
                    );
            }

            await tx
                .insert(authenticatorWalletBindingsTable)
                .values({
                    authenticatorId: credentialId,
                    chainId,
                    smartWalletAddress: toSmartWalletAddress,
                    createdAt: now,
                    reason,
                })
                .onConflictDoNothing();

            await tx
                .update(authenticatorsTable)
                .set({ smartWalletAddress: toSmartWalletAddress })
                .where(eq(authenticatorsTable.id, credentialId));

            const [freshRow] = await tx
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
        });
    }

    /**
     * Idempotent lazy back-fill helper for credentials that pre-date the
     * binding table. Called on each successful login: if the credential has
     * no active bindings yet, seeds one per Frak chain using the freshly
     * computed wallet address. If the legacy `smart_wallet_address` column
     * is also NULL (very old rows), populates it too.
     */
    public async ensureActiveBindings({
        credentialId,
        smartWalletAddress,
    }: {
        credentialId: string;
        smartWalletAddress: Address;
    }): Promise<void> {
        const existing = await this.getActiveBindings(credentialId);
        const haveChains = new Set(existing.map((b) => b.chainId));
        if (frakChainIds.every((chainId) => haveChains.has(chainId))) return;

        const credential = await this.getByCredentialId(credentialId);

        const db = getLibsqlDb();
        await db.transaction(async (tx) => {
            await this.seedInitialBindings(tx, {
                credentialId,
                smartWalletAddress,
            });

            if (credential && !credential.smartWalletAddress) {
                await tx
                    .update(authenticatorsTable)
                    .set({ smartWalletAddress })
                    .where(eq(authenticatorsTable.id, credentialId));
            }
        });
    }

    /**
     * Insert one initial binding per Frak chain for the credential. Used by
     * `createAuthenticator` and by the lazy back-fill path on login.
     *
     * Always invoked inside an enclosing libSQL transaction so the binding
     * inserts commit atomically with the caller's other writes (legacy row
     * insert or back-fill).
     *
     * Blind-retry semantics: `ON CONFLICT DO NOTHING` on the partial unique
     * `(authenticator_id, chain_id) WHERE unlinked_at IS NULL` makes the call
     * safe to retry on a fresh credential or after an empty-bindings check.
     * It does NOT detect divergence — if the credential's active binding was
     * previously repointed (e.g. via a merge), the conflict-skip will silently
     * leave the merged binding in place even when the caller passes a
     * different `smartWalletAddress`. Callers must therefore only invoke this
     * during register or against a confirmed-empty `getActiveBindings` result.
     */
    private async seedInitialBindings(
        tx: LibsqlTx,
        {
            credentialId,
            smartWalletAddress,
        }: {
            credentialId: string;
            smartWalletAddress: Address;
        }
    ): Promise<void> {
        const now = nowSeconds();
        await tx
            .insert(authenticatorWalletBindingsTable)
            .values(
                frakChainIds.map((chainId) => ({
                    authenticatorId: credentialId,
                    chainId,
                    smartWalletAddress,
                    createdAt: now,
                    reason: "initial" as const,
                }))
            )
            .onConflictDoNothing();
    }
}

function nowSeconds(): number {
    return Math.floor(Date.now() / 1000);
}
