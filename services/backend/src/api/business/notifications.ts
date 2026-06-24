import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import {
    NotificationContext,
    type PushHistoryItem,
    PushHistoryItemSchema,
    SendNotificationPayloadDto,
    SendNotificationTargetsDto,
} from "../../domain/notifications";
import type { BroadcastWithStats } from "../../domain/notifications/repositories/NotificationBroadcastRepository";
import { OrchestrationContext } from "../../orchestration";
import { businessSessionContext } from "./middleware/session";

/**
 * Shape a stored broadcast (+ delivery stats) into the row the dashboard
 * push-history table consumes. A broadcast is still `scheduled` while it has a
 * future `scheduledAt` the cron hasn't claimed yet; everything else is `sent`.
 */
function toPushHistoryItem(broadcast: BroadcastWithStats): PushHistoryItem {
    const { payload, targets } = broadcast;
    const isScheduled =
        broadcast.scheduledAt !== null && broadcast.claimedAt === null;
    const walletCount =
        targets && "wallets" in targets ? targets.wallets.length : null;
    const audienceLabel =
        walletCount !== null ? `${walletCount} members` : "All members";

    return {
        id: broadcast.id,
        title: payload.title,
        status: isScheduled ? "scheduled" : "sent",
        scheduledAt: (broadcast.scheduledAt ?? broadcast.createdAt).getTime(),
        audienceLabel,
        sent: isScheduled ? null : broadcast.sentCount,
        opened: isScheduled ? null : broadcast.openedCount,
        payload: {
            title: payload.title,
            body: payload.body,
            icon: payload.icon,
            url: payload.data?.url,
        },
        target: targets ?? undefined,
        targetCount: walletCount ?? broadcast.sentCount,
    };
}

async function assertMerchantAccess({
    businessSession,
    hasMerchantAccess,
    merchantId,
}: {
    businessSession: unknown;
    hasMerchantAccess: (merchantId: string) => Promise<boolean>;
    merchantId: string;
}) {
    if (!businessSession) {
        return status(401, "Unauthorized");
    }
    if (!(await hasMerchantAccess(merchantId))) {
        return status(403, "Forbidden");
    }
    return null;
}

export const notificationsRoutes = new Elysia({ prefix: "/notifications" })
    .use(businessSessionContext)
    .post(
        "/send",
        async ({
            body: { targets, payload, merchantId },
            businessSession,
            hasMerchantAccess,
        }) => {
            const denied = await assertMerchantAccess({
                businessSession,
                hasMerchantAccess,
                merchantId,
            });
            if (denied) return denied;

            await NotificationContext.services.notifications.cleanupExpiredTokens();

            const wallets =
                await OrchestrationContext.orchestrators.notification.resolveWalletsFromTargets(
                    targets,
                    merchantId
                );

            const broadcast =
                await NotificationContext.repositories.notificationBroadcast.create(
                    {
                        merchantId,
                        payload,
                    }
                );

            await OrchestrationContext.orchestrators.notification.sendPromotionalNotification(
                {
                    wallets,
                    payload,
                    broadcastId: broadcast.id,
                }
            );
        },
        {
            body: t.Object({
                merchantId: t.String({ format: "uuid" }),
                targets: SendNotificationTargetsDto,
                payload: SendNotificationPayloadDto,
            }),
        }
    )
    .post(
        "/schedule",
        async ({
            body: { targets, payload, merchantId, scheduledAt },
            businessSession,
            hasMerchantAccess,
        }) => {
            const denied = await assertMerchantAccess({
                businessSession,
                hasMerchantAccess,
                merchantId,
            });
            if (denied) return denied;

            if (scheduledAt.getTime() <= Date.now()) {
                return status(400, "scheduledAt must be in the future");
            }

            const broadcast =
                await NotificationContext.repositories.notificationBroadcast.create(
                    {
                        merchantId,
                        payload,
                        targets,
                        scheduledAt,
                    }
                );

            return { id: broadcast.id, scheduledAt };
        },
        {
            body: t.Object({
                merchantId: t.String({ format: "uuid" }),
                targets: SendNotificationTargetsDto,
                payload: SendNotificationPayloadDto,
                scheduledAt: t.Date(),
            }),
        }
    )
    .put(
        "/scheduled/:id",
        async ({
            params: { id },
            body: { targets, payload, merchantId, scheduledAt },
            businessSession,
            hasMerchantAccess,
        }) => {
            const denied = await assertMerchantAccess({
                businessSession,
                hasMerchantAccess,
                merchantId,
            });
            if (denied) return denied;

            if (scheduledAt.getTime() <= Date.now()) {
                return status(400, "scheduledAt must be in the future");
            }

            const updated =
                await NotificationContext.repositories.notificationBroadcast.updateScheduled(
                    id,
                    merchantId,
                    { payload, targets, scheduledAt }
                );

            if (!updated) {
                return status(404, "Scheduled notification not found");
            }

            return { id, scheduledAt };
        },
        {
            params: t.Object({
                id: t.String({ format: "uuid" }),
            }),
            body: t.Object({
                merchantId: t.String({ format: "uuid" }),
                targets: SendNotificationTargetsDto,
                payload: SendNotificationPayloadDto,
                scheduledAt: t.Date(),
            }),
        }
    )
    .get(
        "/scheduled",
        async ({
            query: { merchantId },
            businessSession,
            hasMerchantAccess,
        }) => {
            const denied = await assertMerchantAccess({
                businessSession,
                hasMerchantAccess,
                merchantId,
            });
            if (denied) return denied;

            return NotificationContext.repositories.notificationBroadcast.listScheduled(
                merchantId
            );
        },
        {
            query: t.Object({
                merchantId: t.String({ format: "uuid" }),
            }),
        }
    )
    .get(
        "/broadcasts",
        async ({
            query: { merchantId },
            businessSession,
            hasMerchantAccess,
        }) => {
            const denied = await assertMerchantAccess({
                businessSession,
                hasMerchantAccess,
                merchantId,
            });
            if (denied) return denied;

            const broadcasts =
                await NotificationContext.repositories.notificationBroadcast.listBroadcasts(
                    merchantId
                );

            return broadcasts.map(toPushHistoryItem);
        },
        {
            query: t.Object({
                merchantId: t.String({ format: "uuid" }),
            }),
            response: {
                200: t.Array(PushHistoryItemSchema),
                401: t.String(),
                403: t.String(),
            },
        }
    )
    .delete(
        "/broadcasts/:id",
        async ({
            params: { id },
            query: { merchantId },
            businessSession,
            hasMerchantAccess,
        }) => {
            const denied = await assertMerchantAccess({
                businessSession,
                hasMerchantAccess,
                merchantId,
            });
            if (denied) return denied;

            const deleted =
                await NotificationContext.repositories.notificationBroadcast.deleteBroadcast(
                    id,
                    merchantId
                );

            if (!deleted) {
                return status(404, "Broadcast not found");
            }

            return { deleted };
        },
        {
            params: t.Object({
                id: t.String({ format: "uuid" }),
            }),
            query: t.Object({
                merchantId: t.String({ format: "uuid" }),
            }),
        }
    )
    .delete(
        "/scheduled/:id",
        async ({
            params: { id },
            query: { merchantId },
            businessSession,
            hasMerchantAccess,
        }) => {
            const denied = await assertMerchantAccess({
                businessSession,
                hasMerchantAccess,
                merchantId,
            });
            if (denied) return denied;

            const deleted =
                await NotificationContext.repositories.notificationBroadcast.deleteScheduled(
                    id,
                    merchantId
                );

            if (!deleted) {
                return status(404, "Scheduled notification not found");
            }

            return { deleted };
        },
        {
            params: t.Object({
                id: t.String({ format: "uuid" }),
            }),
            query: t.Object({
                merchantId: t.String({ format: "uuid" }),
            }),
        }
    );
