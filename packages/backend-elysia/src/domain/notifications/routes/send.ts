import { indexerApiContext, log, nextSessionContext } from "@backend-common";
import { t } from "@backend-utils";
import type { GetMembersWalletResponseDto } from "@frak-labs/app-essentials";
import { Mutex } from "async-mutex";
import { Elysia } from "elysia";
import type { KyInstance } from "ky";
import type { Address } from "viem";
import { notificationContext } from "../context";
import {
    SendNotificationPayloadDto,
    SendNotificationTargetsDto,
} from "../dto/SendNotificationDto";

export const sendRoutes = new Elysia()
    .use(notificationContext)
    .use(nextSessionContext)
    .use(indexerApiContext)
    .decorate({
        sendNotifMutex: new Mutex(),
    })
    // External endpoint to send notification to a list of wallets
    .post(
        "/send",
        async ({
            body: { targets, payload },
            notification: { service },
            sendNotifMutex,
            indexerApi,
            businessSession,
        }) =>
            sendNotifMutex.runExclusive(async () => {
                if (!businessSession) return;

                await service.cleanupExpiredTokens();

                // todo: Notification tracking (send, received, clicked)

                // Find every push tokens for the given wallets
                const wallets = await getWalletsTargets({
                    targets: targets,
                    wallet: businessSession.wallet,
                    indexerApi,
                });

                // Send the notification
                await service.sendNotification({
                    wallets,
                    payload,
                });
            }),
        {
            nextAuthenticated: "business",
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
    indexerApi,
    wallet,
}: {
    targets: typeof SendNotificationTargetsDto.static;
    indexerApi: KyInstance;
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
