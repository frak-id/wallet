import { getLibsqlDb } from "@backend-infrastructure";
import {
    type FrakChainId,
    frakChainIds,
} from "@frak-labs/app-essentials/blockchain";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { Address } from "viem";
import {
    type AuthenticatorBindingSelect,
    authenticatorsTable,
    authenticatorWalletBindingsTable,
    type BindingReason,
} from "../db/schema";
import type { AuthenticatorDocument } from "../models/dto/AuthenticatorDocument";

/**
 * Email reconciliation policy when repointing a binding (e.g. during a merge).
 * `keep` carries the previous email forward; `clear` drops it; passing an
 * explicit string sets the new value verbatim.
 */
export type RepointEmailPolicy = "keep" | "clear" | { email: string };

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
     * returned `smartWalletAddress` / `email` fields are the legacy denormalised
     * values from the `authenticators` row. Callers that need chain-scoped
     * answers should use `getActiveBinding(s)`.
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
            email: row.email ?? undefined,
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
            email: row.email ?? undefined,
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
                    email: authenticator.email,
                })
                .onConflictDoNothing()
                .returning();

            if (authenticator.smartWalletAddress) {
                await this.seedInitialBindings(tx, {
                    credentialId: authenticator._id,
                    smartWalletAddress: authenticator.smartWalletAddress,
                    email: authenticator.email ?? null,
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
     * Case-insensitive lookup of the most recent active binding carrying the
     * given email on the requested chain. Falls back to the legacy
     * `authenticators.email` column for credentials that haven't been
     * back-filled yet.
     */
    public async findByEmail({
        chainId,
        email,
    }: {
        chainId: FrakChainId;
        email: string;
    }): Promise<{
        authenticatorId: string;
        smartWalletAddress: Address | null;
    } | null> {
        const db = getLibsqlDb();
        const normalized = email.trim().toLowerCase();

        const [bindingRow] = await db
            .select({
                authenticatorId:
                    authenticatorWalletBindingsTable.authenticatorId,
                smartWalletAddress:
                    authenticatorWalletBindingsTable.smartWalletAddress,
            })
            .from(authenticatorWalletBindingsTable)
            .where(
                and(
                    sql`LOWER(${authenticatorWalletBindingsTable.email}) = ${normalized}`,
                    eq(authenticatorWalletBindingsTable.chainId, chainId),
                    isNull(authenticatorWalletBindingsTable.unlinkedAt)
                )
            )
            .limit(1);
        if (bindingRow) {
            return {
                authenticatorId: bindingRow.authenticatorId,
                smartWalletAddress: bindingRow.smartWalletAddress as Address,
            };
        }

        const [row] = await db
            .select({
                id: authenticatorsTable.id,
                smartWalletAddress: authenticatorsTable.smartWalletAddress,
            })
            .from(authenticatorsTable)
            .where(sql`LOWER(${authenticatorsTable.email}) = ${normalized}`)
            .limit(1);
        if (!row) return null;
        return {
            authenticatorId: row.id,
            smartWalletAddress:
                (row.smartWalletAddress as Address | null) ?? null,
        };
    }

    /**
     * Get the email currently attached to a credential. Reads from any active
     * binding (the email is denormalised across a credential's bindings so any
     * active row carries the same value).
     *
     * Assumes the bootstrap back-fill has run, which is a precondition of the
     * backend boot sequence — no legacy-column fallback.
     */
    public async getEmail(credentialId: string): Promise<string | null> {
        const db = getLibsqlDb();
        const [bindingRow] = await db
            .select({ email: authenticatorWalletBindingsTable.email })
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
            .limit(1);
        return bindingRow?.email ?? null;
    }

    /**
     * Attach an email to an existing authenticator. Used by the post-auth
     * "add my email" flow on a credential that was registered without one.
     *
     * Updates every active binding for the credential (denormalised across
     * chains) AND the legacy `authenticators.email` column so reads stay
     * consistent regardless of which column the consumer hits first.
     *
     * Returns whether at least one row was updated so callers can distinguish
     * a missing credential from a successful update.
     */
    public async updateEmail({
        credentialId,
        email,
    }: {
        credentialId: string;
        email: string;
    }): Promise<{ updated: boolean }> {
        const db = getLibsqlDb();
        return db.transaction(async (tx) => {
            const legacyUpdate = await tx
                .update(authenticatorsTable)
                .set({ email })
                .where(eq(authenticatorsTable.id, credentialId))
                .returning({ id: authenticatorsTable.id });
            if (legacyUpdate.length === 0) {
                return { updated: false };
            }

            await tx
                .update(authenticatorWalletBindingsTable)
                .set({ email })
                .where(
                    and(
                        eq(
                            authenticatorWalletBindingsTable.authenticatorId,
                            credentialId
                        ),
                        isNull(authenticatorWalletBindingsTable.unlinkedAt)
                    )
                );

            return { updated: true };
        });
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
     * Also updates the legacy `authenticators.smart_wallet_address` and
     * `authenticators.email` columns so dual-write consumers stay in sync.
     *
     * All four statements (read existing, stamp `unlinked_at`, insert new
     * active binding, update legacy columns) run inside a single libSQL
     * transaction so a crash mid-way can never strand the credential without
     * an active binding.
     */
    public async repointBinding({
        credentialId,
        chainId,
        toSmartWalletAddress,
        emailPolicy,
        reason,
    }: {
        credentialId: string;
        chainId: FrakChainId;
        toSmartWalletAddress: Address;
        emailPolicy: RepointEmailPolicy;
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

            const resolvedEmail = resolveEmailPolicy(
                existingRow?.email ?? null,
                emailPolicy
            );

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
                    email: resolvedEmail,
                    createdAt: now,
                    reason,
                })
                .onConflictDoNothing();

            await tx
                .update(authenticatorsTable)
                .set({
                    smartWalletAddress: toSmartWalletAddress,
                    email: resolvedEmail,
                })
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
        const email =
            existing.find((b) => b.email)?.email ?? credential?.email ?? null;

        const db = getLibsqlDb();
        await db.transaction(async (tx) => {
            await this.seedInitialBindings(tx, {
                credentialId,
                smartWalletAddress,
                email,
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
            email,
        }: {
            credentialId: string;
            smartWalletAddress: Address;
            email: string | null;
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
                    email,
                    createdAt: now,
                    reason: "initial" as const,
                }))
            )
            .onConflictDoNothing();
    }
}

function resolveEmailPolicy(
    current: string | null,
    policy: RepointEmailPolicy
): string | null {
    if (policy === "keep") return current;
    if (policy === "clear") return null;
    return policy.email;
}

function nowSeconds(): number {
    return Math.floor(Date.now() / 1000);
}
