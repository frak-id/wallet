import { log } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import type { Address } from "viem";
import {
    NotificationContext,
    SendNotificationPayloadDto,
    SendNotificationTargetsDto,
} from "../../domain/notifications";
import { OrchestrationContext } from "../../orchestration";
import { businessSessionContext } from "./middleware/session";

async function getWalletsTargets({
    targets,
    wallet,
}: {
    targets: typeof SendNotificationTargetsDto.static;
    wallet: Address;
}): Promise<Address[]> {
    if ("wallets" in targets) {
        return targets.wallets;
    }

    log.warn(
        `Filter-based notification targeting not yet migrated to DB for wallet ${wallet}. Returning empty list.`
    );
    return [];
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
            if (!businessSession) {
                return status(401, "Unauthorized");
            }

            const hasAccess = await hasMerchantAccess(merchantId);
            if (!hasAccess) {
                return status(403, "Forbidden");
            }

            await NotificationContext.services.notifications.cleanupExpiredTokens();

            const wallets = await getWalletsTargets({
                targets: targets,
                wallet: businessSession.wallet,
            });

            const broadcast =
                await NotificationContext.repositories.notificationBroadcast.create(
                    {
                        merchantId,
                        payload,
                    }
                );

            await OrchestrationContext.orchestrators.notification.sendNotifications(
                [
                    {
                        wallets,
                        template: {
                            type: "promotional",
                            title: payload.title,
                            body: payload.body,
                            broadcastId: broadcast.id,
                        },
                    },
                ]
            );
        },
        {
            body: t.Object({
                merchantId: t.String({ format: "uuid" }),
                targets: SendNotificationTargetsDto,
                payload: SendNotificationPayloadDto,
            }),
        }
    );
