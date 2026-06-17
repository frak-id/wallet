import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import {
    NotificationContext,
    SendNotificationPayloadDto,
    SendNotificationTargetsDto,
} from "../../domain/notifications";
import { OrchestrationContext } from "../../orchestration";
import { businessSessionContext } from "./middleware/session";

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
                    targets
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
