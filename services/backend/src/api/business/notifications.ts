import { log } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import type { Address } from "viem";
import {
    NotificationContext,
    SendNotificationPayloadDto,
    SendNotificationTargetsDto,
} from "../../domain/notifications";
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

            await NotificationContext.services.notifications.sendNotification({
                wallets,
                payload,
            });
        },
        {
            body: t.Object({
                merchantId: t.String({ format: "uuid" }),
                targets: SendNotificationTargetsDto,
                payload: SendNotificationPayloadDto,
            }),
        }
    );
