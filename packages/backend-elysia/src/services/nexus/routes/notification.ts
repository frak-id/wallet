import { Mutex } from "async-mutex";
import { inArray, lt } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { parallel } from "radash";
import { Config } from "sst/node/config";
import type { Address } from "viem";
import { sendNotification, setVapidDetails } from "web-push";
import { nexusContext } from "../context";
import { pushTokens } from "../db/schema";

export const notificationRoutes = new Elysia({ prefix: "notification" })
    .use(nexusContext)
    .decorate({
        sendNotifMutex: new Mutex(),
    })
    .post(
        "/send",
        async ({ body: { wallets, payload }, nexusDb, sendNotifMutex }) =>
            sendNotifMutex.runExclusive(async () => {
                // todo: 1. Secure 2. Notification tracking (send, received, clicked)
                // Remove every push tokens expired
                await nexusDb
                    .delete(pushTokens)
                    .where(lt(pushTokens.expireAt, new Date()))
                    .execute();

                // Find every push tokens for the given wallets
                const tokens = await nexusDb.query.pushTokens.findMany({
                    where: inArray(pushTokens.wallet, wallets as Address[]),
                });
                if (tokens.length === 0) {
                    console.log("No push tokens found for the given wallets");
                    return;
                }
                console.log(`Sending notification to ${tokens.length} wallets`);

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
                wallets: t.Array(t.String()),
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
