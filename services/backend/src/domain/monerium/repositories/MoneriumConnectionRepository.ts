import { db } from "@backend-infrastructure";
import type { MoneriumProfileState } from "@frak-labs/app-essentials/monerium";
import {
    and,
    eq,
    inArray,
    isNull,
    notInArray,
    or,
    type SQL,
    sql,
} from "drizzle-orm";
import type { Address } from "viem";
import {
    type MoneriumConnectionRow,
    moneriumConnectionsTable,
} from "../db/schema";
import { dueWithBackoff, oldestCheckFirst, type RecheckTier } from "./dueTiers";

type ClaimParams = { now: Date; tiers: readonly RecheckTier[]; limit: number };

export type MoneriumConnectionPatch = Partial<
    Omit<MoneriumConnectionRow, "wallet" | "createdAt" | "updatedAt">
>;

/** Applies a patch to the connection row that is locked for the current transaction. */
export type LockedConnectionWriter = (
    patch: MoneriumConnectionPatch
) => Promise<void>;

const TERMINAL_PROFILE_STATES: MoneriumProfileState[] = [
    "approved",
    "rejected",
    "closed",
];

export class MoneriumConnectionRepository {
    async findByWallet(
        wallet: Address
    ): Promise<MoneriumConnectionRow | undefined> {
        const [row] = await db
            .select()
            .from(moneriumConnectionsTable)
            .where(eq(moneriumConnectionsTable.wallet, wallet))
            .limit(1);
        return row;
    }

    /** Keeps the profile and link cache of an existing row: a reconnect does not forget them. */
    async upsertConnected(params: {
        wallet: Address;
        accessTokenEncrypted: string;
        accessTokenExpiresAt: Date;
        refreshTokenEncrypted: string;
    }): Promise<void> {
        const tokens = {
            status: "connected" as const,
            accessTokenEncrypted: params.accessTokenEncrypted,
            accessTokenExpiresAt: params.accessTokenExpiresAt,
            refreshTokenEncrypted: params.refreshTokenEncrypted,
        };
        await db
            .insert(moneriumConnectionsTable)
            .values({
                wallet: params.wallet,
                profileStateChangedAt: new Date(),
                ...tokens,
            })
            .onConflictDoUpdate({
                target: moneriumConnectionsTable.wallet,
                set: {
                    ...tokens,
                    profileStateChangedAt: new Date(),
                    siweFailedAt: null,
                    updatedAt: new Date(),
                },
            });
    }

    async update(
        wallet: Address,
        patch: MoneriumConnectionPatch
    ): Promise<void> {
        await db
            .update(moneriumConnectionsTable)
            .set({ ...patch, updatedAt: new Date() })
            .where(eq(moneriumConnectionsTable.wallet, wallet));
    }

    /**
     * Compare-and-set on the profile state, so that when several pods observe the
     * same transition only one gets a row back and notifies.
     */
    async updateIfProfileState(
        wallet: Address,
        expectedState: MoneriumProfileState | null,
        patch: MoneriumConnectionPatch
    ): Promise<MoneriumConnectionRow | undefined> {
        const stateMatches =
            expectedState === null
                ? isNull(moneriumConnectionsTable.profileState)
                : eq(moneriumConnectionsTable.profileState, expectedState);
        const [row] = await db
            .update(moneriumConnectionsTable)
            .set({ ...patch, updatedAt: new Date() })
            .where(
                and(eq(moneriumConnectionsTable.wallet, wallet), stateMatches)
            )
            .returning();
        return row;
    }

    /**
     * Runs `task` in a transaction holding `SELECT ... FOR UPDATE` on the row, so only
     * one pod at a time can spend a refresh token (they rotate on every use).
     */
    withLockedConnection<T>(
        wallet: Address,
        task: (
            row: MoneriumConnectionRow | undefined,
            write: LockedConnectionWriter
        ) => Promise<T>
    ): Promise<T> {
        return db.transaction(async (tx) => {
            const [row] = await tx
                .select()
                .from(moneriumConnectionsTable)
                .where(eq(moneriumConnectionsTable.wallet, wallet))
                .limit(1)
                .for("update");
            return task(row, async (patch) => {
                await tx
                    .update(moneriumConnectionsTable)
                    .set({ ...patch, updatedAt: new Date() })
                    .where(eq(moneriumConnectionsTable.wallet, wallet));
            });
        });
    }

    async deleteByWallet(wallet: Address): Promise<void> {
        await db
            .delete(moneriumConnectionsTable)
            .where(eq(moneriumConnectionsTable.wallet, wallet));
    }

    /**
     * Claims connected wallets whose profile can still change: `state_checked_at` is
     * stamped in the same statement, so concurrent pods never get the same row.
     */
    claimDueForProfileSync(
        params: ClaimParams
    ): Promise<MoneriumConnectionRow[]> {
        return this.claimDue(
            and(
                or(
                    isNull(moneriumConnectionsTable.profileState),
                    notInArray(
                        moneriumConnectionsTable.profileState,
                        TERMINAL_PROFILE_STATES
                    )
                ),
                dueWithBackoff({
                    started: moneriumConnectionsTable.profileStateChangedAt,
                    checkedAt: moneriumConnectionsTable.stateCheckedAt,
                    tiers: params.tiers,
                    now: params.now,
                })
            ),
            params
        );
    }

    claimDueForLinkSync(params: ClaimParams): Promise<MoneriumConnectionRow[]> {
        return this.claimDue(
            and(
                eq(moneriumConnectionsTable.walletLinkState, "pending"),
                dueWithBackoff({
                    started: sql`coalesce(${moneriumConnectionsTable.walletLinkPendingAt}, ${moneriumConnectionsTable.updatedAt})`,
                    checkedAt: moneriumConnectionsTable.stateCheckedAt,
                    tiers: params.tiers,
                    now: params.now,
                })
            ),
            params
        );
    }

    private claimDue(
        condition: SQL | undefined,
        params: ClaimParams
    ): Promise<MoneriumConnectionRow[]> {
        const due = db
            .select({ wallet: moneriumConnectionsTable.wallet })
            .from(moneriumConnectionsTable)
            .where(
                and(eq(moneriumConnectionsTable.status, "connected"), condition)
            )
            .orderBy(oldestCheckFirst(moneriumConnectionsTable.stateCheckedAt))
            .limit(params.limit)
            .for("update", { skipLocked: true });
        return db
            .update(moneriumConnectionsTable)
            .set({ stateCheckedAt: params.now })
            .where(inArray(moneriumConnectionsTable.wallet, due))
            .returning();
    }
}
