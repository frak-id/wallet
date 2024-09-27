import { log } from "@backend-common";
import { t } from "@backend-utils";
import { Mutex } from "async-mutex";
import { inArray, lt } from "drizzle-orm";
import { Elysia } from "elysia";
import { parallel } from "radash";
import { Config } from "sst/node/config";
import { sendNotification, setVapidDetails } from "web-push";
import { pushTokensTable } from "../../db/schema";
import { notificationContext } from "../context";

export const sendRoutes = new Elysia()
    .use(notificationContext)
    .decorate({
        sendNotifMutex: new Mutex(),
    })
    // External endpoint to send notification to a list of wallets
    .post(
        "/send",
        async ({
            body: { wallets, payload },
            notificationDb,
            sendNotifMutex,
        }) =>
            sendNotifMutex.runExclusive(async () => {
                // todo: Secure stuff here
                // todo: Notification tracking (send, received, clicked)

                // Remove every push tokens expired
                await notificationDb
                    .delete(pushTokensTable)
                    .where(lt(pushTokensTable.expireAt, new Date()))
                    .execute();

                // Find every push tokens for the given wallets
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

                // Send all the notification in parallel, by batch of 100
                await parallel(
                    100,
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
            body: t.Object({
                wallets: t.Array(t.Address()),
                payload: t.Object({
                    title: t.String(),
                    body: t.String(),
                    badge: t.Optional(t.String()),
                    icon: t.Optional(t.String()),
                    lang: t.Optional(t.String()),
                    requireInteraction: t.Optional(t.Boolean()),
                    silent: t.Optional(t.Boolean()),
                    tag: t.Optional(t.String()),
                    data: t.Optional(
                        t.Object({
                            url: t.Optional(t.String()),
                        })
                    ),
                    actions: t.Optional(
                        t.Array(
                            t.Object({
                                action: t.String(),
                                title: t.String(),
                                icon: t.Optional(t.String()),
                            })
                        )
                    ),
                }),
            }),
        }
    );
