import { log } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { Elysia } from "elysia";
import type { Address } from "viem";
import {
    NotificationContext,
    SendNotificationPayloadDto,
    SendNotificationTargetsDto,
} from "../../../../domain/notifications";
import { businessSessionContext } from "../../middleware/session";

export const sendRoutes = new Elysia()
    .use(businessSessionContext)
    // External endpoint to send notification to a list of wallets
    .post(
        "/send",
        async ({ body: { targets, payload }, businessSession }) => {
            if (!businessSession) return;

            await NotificationContext.services.notifications.cleanupExpiredTokens();

            // todo: Notification tracking (send, received, clicked)

            // Find every push tokens for the given wallets
            const wallets = await getWalletsTargets({
                targets: targets,
                wallet: businessSession.wallet,
            });

            // Send the notification
            await NotificationContext.services.notifications.sendNotification({
                wallets,
                payload,
            });
        },
        {
            body: t.Object({
                targets: SendNotificationTargetsDto,
                payload: SendNotificationPayloadDto,
            }),
        }
    );

/**
 * Get a list of wallets depending on the notification target
 */
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

    // TODO: Migrate to DB-based member query once indexer is fully removed
    log.warn(
        `Filter-based notification targeting not yet migrated to DB for wallet ${wallet}. Returning empty list.`
    );
    return [];
}
