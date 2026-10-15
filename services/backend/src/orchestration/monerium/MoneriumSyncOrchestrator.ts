import type { LocalisedNotificationPayload } from "@backend-domain/notifications";
import { log } from "@backend-infrastructure";
import type { Address } from "viem";
import { requireMoneriumConfig } from "../../domain/monerium/config";
import { MoneriumApiError } from "../../domain/monerium/errors";
import type { MoneriumConnectionRepository } from "../../domain/monerium/repositories/MoneriumConnectionRepository";
import type { MoneriumTrackedOrderRepository } from "../../domain/monerium/repositories/MoneriumTrackedOrderRepository";
import type { MoneriumOrderService } from "../../domain/monerium/services/MoneriumOrderService";
import type { MoneriumStatusService } from "../../domain/monerium/services/MoneriumStatusService";
import type { NotificationsService } from "../../domain/notifications/services/NotificationsService";
import { moneriumMessages } from "./moneriumMessages";

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export const MONERIUM_SYNC = {
    ORDER_RECHECK_MS: 2 * MINUTE_MS,
    ORDER_MAX_AGE_MS: 14 * DAY_MS,
    PROFILE_RECHECK_MS: 10 * MINUTE_MS,
    PROFILE_MAX_AGE_MS: 30 * DAY_MS,
    LINK_RECHECK_MS: 2 * MINUTE_MS,
    BATCH_CAP: 50,
} as const;

export type MoneriumSyncSummary = {
    orders: number;
    profiles: number;
    links: number;
    stoppedOnRateLimit: boolean;
};

/**
 * Polls Monerium for what changed since the user last looked, because the OAuth plan has
 * no webhooks. Each transition is applied with a compare-and-set, and only the pod that
 * wins it sends the push, so a transition is never announced twice.
 */
export class MoneriumSyncOrchestrator {
    private pausedUntil = 0;

    constructor(
        private readonly connections: MoneriumConnectionRepository,
        private readonly trackedOrders: MoneriumTrackedOrderRepository,
        private readonly status: MoneriumStatusService,
        private readonly orders: MoneriumOrderService,
        private readonly notifications: NotificationsService
    ) {}

    async syncTick(now = new Date()): Promise<MoneriumSyncSummary> {
        const summary: MoneriumSyncSummary = {
            orders: 0,
            profiles: 0,
            links: 0,
            stoppedOnRateLimit: false,
        };
        if (now.getTime() < this.pausedUntil) return summary;

        let walletUrl: string;
        try {
            walletUrl = `${requireMoneriumConfig().walletUrl}/wallet?open=monerium`;
        } catch {
            return summary;
        }

        const ago = (ms: number) => new Date(now.getTime() - ms);
        const dueOrders = await this.trackedOrders.findInFlightDue({
            checkedBefore: ago(MONERIUM_SYNC.ORDER_RECHECK_MS),
            createdAfter: ago(MONERIUM_SYNC.ORDER_MAX_AGE_MS),
            limit: MONERIUM_SYNC.BATCH_CAP,
        });
        const dueProfiles = await this.connections.findDueForProfileSync({
            checkedBefore: ago(MONERIUM_SYNC.PROFILE_RECHECK_MS),
            createdAfter: ago(MONERIUM_SYNC.PROFILE_MAX_AGE_MS),
            limit: MONERIUM_SYNC.BATCH_CAP,
        });
        const dueLinks = await this.connections.findDueForLinkSync({
            checkedBefore: ago(MONERIUM_SYNC.LINK_RECHECK_MS),
            createdAfter: ago(MONERIUM_SYNC.PROFILE_MAX_AGE_MS),
            limit: MONERIUM_SYNC.BATCH_CAP,
        });

        for (const order of dueOrders) {
            if (summary.stoppedOnRateLimit) break;
            await this.guard(
                summary,
                () => this.syncOrder(order, walletUrl),
                () => this.trackedOrders.markChecked(order.id)
            );
            summary.orders++;
        }

        const seen = new Set<string>();
        for (const connection of [...dueProfiles, ...dueLinks]) {
            if (summary.stoppedOnRateLimit) break;
            if (seen.has(connection.wallet)) continue;
            seen.add(connection.wallet);
            await this.guard(
                summary,
                () => this.syncConnection(connection.wallet, walletUrl),
                () =>
                    this.connections.update(connection.wallet, {
                        stateCheckedAt: new Date(),
                    })
            );
            if (dueProfiles.includes(connection)) summary.profiles++;
            else summary.links++;
        }
        return summary;
    }

    /** A 429 ends the tick and pauses the next ones; any other failure only defers that item. */
    private async guard(
        summary: MoneriumSyncSummary,
        task: () => Promise<void>,
        defer: () => Promise<void>
    ): Promise<void> {
        try {
            await task();
        } catch (error) {
            if (error instanceof MoneriumApiError && error.status === 429) {
                summary.stoppedOnRateLimit = true;
                this.pausedUntil =
                    Date.now() + (error.retryAfterSeconds ?? 0) * 1000;
                log.warn("[MoneriumSync] rate limited, stopping the tick");
                return;
            }
            log.warn(
                { error: error instanceof Error ? error.message : "unknown" },
                "[MoneriumSync] item failed, deferred to a later tick"
            );
            await defer().catch(() => undefined);
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
        const { after, profileChanged } =
            await this.status.refreshFromMonerium(wallet);
        if (!profileChanged) return;

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
                { error: error instanceof Error ? error.message : "unknown" },
                "[MoneriumSync] push failed"
            );
        }
    }
}
