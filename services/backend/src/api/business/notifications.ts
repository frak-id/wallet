import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import {
    NotificationContext,
    type PushBroadcast,
    PushBroadcastSchema,
    SendNotificationPayloadDto,
    SendNotificationTargetsDto,
} from "../../domain/notifications";
import type { BroadcastWithStats } from "../../domain/notifications/repositories/NotificationBroadcastRepository";
import { OrchestrationContext } from "../../orchestration";
import { businessSessionContext } from "./middleware/session";

/**
 * Project a stored broadcast (+ delivery stats) onto the wire shape: DB row
 * with timestamps as unix-millis. All presentation (status, audience label,
 * stats formatting) is derived on the dashboard.
 */
function toPushBroadcast(broadcast: BroadcastWithStats): PushBroadcast {
    return {
        id: broadcast.id,
        payload: broadcast.payload,
        targets: broadcast.targets ?? null,
        scheduledAt: broadcast.scheduledAt?.getTime() ?? null,
        claimedAt: broadcast.claimedAt?.getTime() ?? null,
        createdAt: broadcast.createdAt.getTime(),
        sentCount: broadcast.sentCount,
        openedCount: broadcast.openedCount,
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
        "/broadcasts/:id",
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

            return broadcasts.map(toPushBroadcast);
        },
        {
            query: t.Object({
                merchantId: t.String({ format: "uuid" }),
            }),
            response: {
                200: t.Array(PushBroadcastSchema),
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
    );
