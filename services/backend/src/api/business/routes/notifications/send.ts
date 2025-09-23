import { indexerApi, log } from "@backend-common";
import { t } from "@backend-utils";
import type { GetMembersWalletResponseDto } from "@frak-labs/app-essentials";
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

    // Otherwise, query the indexer to fetch the wallets
    const result = await indexerApi
        .post(`members/${wallet}`, {
            json: { filter: targets.filter, onlyAddress: true },
        })
        .json<GetMembersWalletResponseDto>();
    log.debug(`Found ${result.users.length} wallets for the given filter`);
    return result.users;
}
