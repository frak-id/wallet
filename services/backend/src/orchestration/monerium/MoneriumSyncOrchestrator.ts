import type { LocalisedNotificationPayload } from "@backend-domain/notifications";
import { log } from "@backend-infrastructure";
import type { Address } from "viem";
import { requireMoneriumConfig } from "../../domain/monerium/config";
import { describeError, MoneriumApiError } from "../../domain/monerium/errors";
import type { RecheckTier } from "../../domain/monerium/repositories/dueTiers";
import type { MoneriumConnectionRepository } from "../../domain/monerium/repositories/MoneriumConnectionRepository";
import type { MoneriumTrackedOrderRepository } from "../../domain/monerium/repositories/MoneriumTrackedOrderRepository";
import type { MoneriumOrderService } from "../../domain/monerium/services/MoneriumOrderService";
import type { MoneriumRateLimitPause } from "../../domain/monerium/services/MoneriumRateLimitPause";
import {
    LINK_PENDING_MAX_AGE_MS,
    type MoneriumStatusService,
} from "../../domain/monerium/services/MoneriumStatusService";
import type { NotificationsService } from "../../domain/notifications/services/NotificationsService";
import { moneriumMessages } from "./moneriumMessages";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Recheck cadence stretches with the age of what is being waited on, and ends with the last tier. */
export const MONERIUM_SYNC = {
    ORDER_TIERS: [
        { maxAgeMs: HOUR_MS, recheckMs: 2 * MINUTE_MS },
        { maxAgeMs: DAY_MS, recheckMs: 10 * MINUTE_MS },
        { maxAgeMs: 14 * DAY_MS, recheckMs: 30 * MINUTE_MS },
    ],
    PROFILE_TIERS: [
        { maxAgeMs: DAY_MS, recheckMs: 10 * MINUTE_MS },
        { maxAgeMs: 7 * DAY_MS, recheckMs: HOUR_MS },
        { maxAgeMs: 30 * DAY_MS, recheckMs: 6 * HOUR_MS },
    ],
    LINK_TIERS: [
        { maxAgeMs: HOUR_MS, recheckMs: 2 * MINUTE_MS },
        { maxAgeMs: LINK_PENDING_MAX_AGE_MS, recheckMs: 15 * MINUTE_MS },
    ],
    BATCH_CAP: 50,
} as const satisfies Record<string, readonly RecheckTier[] | number>;

export type MoneriumSyncSummary = {
    orders: number;
    profiles: number;
    links: number;
    stoppedOnRateLimit: boolean;
};

type SyncPhase = Exclude<keyof MoneriumSyncSummary, "stoppedOnRateLimit">;

const UNDEFINED_TABLE = "42P01";
let missingTablesLogged = false;

function isMissingTable(error: unknown): boolean {
    let current: unknown = error;
    for (let depth = 0; depth < 3; depth++) {
        if (typeof current !== "object" || current === null) return false;
        if ("code" in current && current.code === UNDEFINED_TABLE) return true;
        current = "cause" in current ? current.cause : null;
    }
    return false;
}

/**
 * Polls Monerium for what changed since the user last looked, because the OAuth plan has
 * no webhooks. Due rows are claimed in one statement so pods never share them, each
 * transition is a compare-and-set, and only the pod that wins it sends the push.
 */
export class MoneriumSyncOrchestrator {
    constructor(
        private readonly connections: MoneriumConnectionRepository,
        private readonly trackedOrders: MoneriumTrackedOrderRepository,
        private readonly status: MoneriumStatusService,
        private readonly orders: MoneriumOrderService,
        private readonly notifications: NotificationsService,
        private readonly rateLimitPause: MoneriumRateLimitPause
    ) {}

    async syncTick(now = new Date()): Promise<MoneriumSyncSummary> {
        const summary: MoneriumSyncSummary = {
            orders: 0,
            profiles: 0,
            links: 0,
            stoppedOnRateLimit: false,
        };
        if (this.rateLimitPause.isPaused(now.getTime())) return summary;

        let walletUrl: string;
        try {
            walletUrl = `${requireMoneriumConfig().walletUrl}/wallet?open=monerium`;
        } catch {
            return summary;
        }

        const claim = { now, limit: MONERIUM_SYNC.BATCH_CAP };
        const syncConnection = (row: { wallet: Address }) =>
            this.syncConnection(row.wallet, walletUrl);
        const tablesPresent =
            (await this.runPhase(
                summary,
                "orders",
                () =>
                    this.trackedOrders.claimInFlightDue({
                        ...claim,
                        tiers: MONERIUM_SYNC.ORDER_TIERS,
                    }),
                (order) => this.syncOrder(order, walletUrl)
            )) &&
            (await this.runPhase(
                summary,
                "profiles",
                () =>
                    this.connections.claimDueForProfileSync({
                        ...claim,
                        tiers: MONERIUM_SYNC.PROFILE_TIERS,
                    }),
                syncConnection
            )) &&
            (await this.runPhase(
                summary,
                "links",
                () =>
                    this.connections.claimDueForLinkSync({
                        ...claim,
                        tiers: MONERIUM_SYNC.LINK_TIERS,
                    }),
                syncConnection
            ));
        if (tablesPresent) await this.deleteStaleOrders(now);
        return summary;
    }

    /**
     * Claims one batch only once the previous phase is done, so a 429 strands as few
     * stamped rows as possible. False while the tables are missing.
     */
    private async runPhase<T>(
        summary: MoneriumSyncSummary,
        phase: SyncPhase,
        claim: () => Promise<T[]>,
        sync: (item: T) => Promise<void>
    ): Promise<boolean> {
        if (this.stopsOnRateLimit(summary)) return true;
        const due = await this.claimUnlessTablesMissing(claim);
        if (!due) return false;
        for (const item of due) {
            if (this.stopsOnRateLimit(summary)) break;
            await this.guard(summary, () => sync(item));
            summary[phase]++;
        }
        return true;
    }

    /** A 429 from any caller, a user request included, pauses the shared instance. */
    private stopsOnRateLimit(summary: MoneriumSyncSummary): boolean {
        if (this.rateLimitPause.isPaused()) summary.stoppedOnRateLimit = true;
        return summary.stoppedOnRateLimit;
    }

    /** Null while the tables are missing: the first deploy can precede the migration. */
    private async claimUnlessTablesMissing<T>(
        claim: () => Promise<T[]>
    ): Promise<T[] | null> {
        try {
            return await claim();
        } catch (error) {
            if (!isMissingTable(error)) throw error;
            if (!missingTablesLogged) {
                missingTablesLogged = true;
                log.warn(
                    "[MoneriumSync] monerium tables are missing, skipping until the migration is applied"
                );
            }
            return null;
        }
    }

    private async deleteStaleOrders(now: Date): Promise<void> {
        try {
            await this.trackedOrders.deleteStale(now);
        } catch (error) {
            log.warn(
                { error: describeError(error) },
                "[MoneriumSync] stale order cleanup failed"
            );
        }
    }

    /** A 429 ends the tick; any other failure only costs that item its turn. */
    private async guard(
        summary: MoneriumSyncSummary,
        task: () => Promise<void>
    ): Promise<void> {
        try {
            await task();
        } catch (error) {
            if (error instanceof MoneriumApiError && error.status === 429) {
                summary.stoppedOnRateLimit = true;
                log.warn("[MoneriumSync] rate limited, stopping the tick");
                return;
            }
            log.warn(
                { error: describeError(error) },
                "[MoneriumSync] item failed, deferred to a later tick"
            );
        }
    }

    private async syncOrder(
        order: Parameters<MoneriumOrderService["syncTrackedOrder"]>[0],
        walletUrl: string
    ): Promise<void> {
        const moved = await this.orders.syncTrackedOrder(order);
        if (moved === "processed") {
            await this.notify(
                order.wallet,
                moneriumMessages.orderProcessed(order.amount, walletUrl)
            );
        } else if (moved === "rejected") {
            await this.notify(
                order.wallet,
                moneriumMessages.orderRejected(order.amount, walletUrl)
            );
        }
    }

    private async syncConnection(
        wallet: Address,
        walletUrl: string
    ): Promise<void> {
        const { before, after, profileChanged } =
            await this.status.refreshFromMonerium(wallet);
        // The first observation is no news: the state may have been reached long ago.
        if (!profileChanged || before.profileState === null) return;

        if (after.profileState === "approved") {
            await this.notify(
                wallet,
                moneriumMessages.profileApproved(
                    after.walletLinkState !== "linked",
                    walletUrl
                )
            );
        } else if (
            after.profileState === "rejected" ||
            after.profileState === "closed"
        ) {
            await this.notify(
                wallet,
                moneriumMessages.profileBlocked(walletUrl)
            );
        }
    }

    /** The state change is already committed: a push failure must never undo or retry it. */
    private async notify(
        wallet: Address,
        payload: LocalisedNotificationPayload
    ): Promise<void> {
        try {
            await this.notifications.sendNotification({
                wallets: [wallet],
                payload,
            });
        } catch (error) {
            log.warn(
                { error: describeError(error) },
                "[MoneriumSync] push failed"
            );
        }
    }
}
