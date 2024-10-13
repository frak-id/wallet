import { indexerApiContext, log, nextSessionContext } from "@backend-common";
import { t } from "@backend-utils";
import { Mutex } from "async-mutex";
import { inArray } from "drizzle-orm";
import { Elysia } from "elysia";
import type { KyInstance } from "ky";
import { parallel } from "radash";
import { Config } from "sst/node/config";
import type { Address } from "viem";
import { sendNotification, setVapidDetails } from "web-push";
import { notificationContext } from "../context";
import { pushTokensTable } from "../db/schema";
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
            notificationDb,
            sendNotifMutex,
            cleanupExpiredTokens,
            indexerApi,
            businessSession,
        }) =>
            sendNotifMutex.runExclusive(async () => {
                if (!businessSession) return;

                await cleanupExpiredTokens();

                // todo: Notification tracking (send, received, clicked)

                // Find every push tokens for the given wallets
                const wallets = await getWalletsTargets({
                    targets: targets,
                    wallet: businessSession.wallet,
                    indexerApi,
                });
                const tokens =
                    await notificationDb.query.pushTokensTable.findMany({
                        where: inArray(pushTokensTable.wallet, wallets),
                    });
                if (tokens.length === 0) {
                    log.debug("No push tokens found for the given wallets");
                    return;
                }
                log.info(`Sending notification to ${tokens.length} wallets`);

                // Set the vapid details for the notification
                setVapidDetails(
                    "mailto:hello@frak.id",
                    Config.VAPID_PUBLIC_KEY,
                    Config.VAPID_PRIVATE_KEY
                );

                // Send all the notification in parallel, by batch of 30
                await parallel(
                    30,
                    tokens,
                    async (token) =>
                        await sendNotification(
                            {
                                endpoint: token.endpoint,
                                keys: {
                                    p256dh: token.keyP256dh,
                                    auth: token.keyAuth,
                                },
                            },
                            JSON.stringify(payload)
                        )
                );
            }),
        {
            isAuthenticated: "business",
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
        .json<{ totalResult: number; users: Address[] }>();
    log.debug(`Found ${result.users.length} wallets for the given filter`);
    return result.users;
}
