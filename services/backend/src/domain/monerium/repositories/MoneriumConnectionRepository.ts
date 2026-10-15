import { db } from "@backend-infrastructure";
import type { MoneriumProfileState } from "@frak-labs/app-essentials/monerium";
import { and, eq, gt, isNull, lt, notInArray, or, type SQL } from "drizzle-orm";
import type { Address } from "viem";
import {
    type MoneriumConnectionRow,
    moneriumConnectionsTable,
} from "../db/schema";

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
        moneriumUserId: string | null;
        accessTokenEncrypted: string;
        accessTokenExpiresAt: Date;
        refreshTokenEncrypted: string;
        clearSiweFailure: boolean;
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
                moneriumUserId: params.moneriumUserId,
                ...tokens,
            })
            .onConflictDoUpdate({
                target: moneriumConnectionsTable.wallet,
                set: {
                    ...tokens,
                    ...(params.moneriumUserId
                        ? { moneriumUserId: params.moneriumUserId }
                        : {}),
                    ...(params.clearSiweFailure ? { siweFailedAt: null } : {}),
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

    /** Connected wallets whose profile can still change, oldest check first. */
    findDueForProfileSync(params: {
        checkedBefore: Date;
        createdAfter: Date;
        limit: number;
    }): Promise<MoneriumConnectionRow[]> {
        return this.findDue(
            or(
                isNull(moneriumConnectionsTable.profileState),
                notInArray(
                    moneriumConnectionsTable.profileState,
                    TERMINAL_PROFILE_STATES
                )
            ),
            params
        );
    }

    findDueForLinkSync(params: {
        checkedBefore: Date;
        createdAfter: Date;
        limit: number;
    }): Promise<MoneriumConnectionRow[]> {
        return this.findDue(
            eq(moneriumConnectionsTable.walletLinkState, "pending"),
            params
        );
    }

    private findDue(
        condition: SQL | undefined,
        params: { checkedBefore: Date; createdAfter: Date; limit: number }
    ): Promise<MoneriumConnectionRow[]> {
        return db
            .select()
            .from(moneriumConnectionsTable)
            .where(
                and(
                    eq(moneriumConnectionsTable.status, "connected"),
                    condition,
                    or(
                        isNull(moneriumConnectionsTable.stateCheckedAt),
                        lt(
                            moneriumConnectionsTable.stateCheckedAt,
                            params.checkedBefore
                        )
                    ),
                    gt(moneriumConnectionsTable.createdAt, params.createdAfter)
                )
            )
            .orderBy(moneriumConnectionsTable.stateCheckedAt)
            .limit(params.limit);
    }
}
