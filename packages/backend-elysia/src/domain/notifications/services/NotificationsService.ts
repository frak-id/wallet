import { inArray, lt } from "drizzle-orm";
import { parallel } from "radash";
import type { Address } from "viem";
import { sendNotification, setVapidDetails } from "web-push";
import { log } from "../../../common";
import type { NotificationDb } from "../context";
import { pushTokensTable } from "../db/schema";
import type { SendNotificationPayload } from "../dto/SendNotificationDto";

export class NotificationsService {
    constructor(private readonly notificationDb: NotificationDb) {}

    /**
     * Send a notification to a list of wallets
     * @param wallets - The wallets to send the notification to
     * @param payload - The payload to send
     * @returns The number of notifications sent
     */
    async sendNotification({
        wallets,
        payload,
    }: {
        wallets: Address[];
        payload: SendNotificationPayload;
    }) {
        const tokens = await this.notificationDb.query.pushTokensTable.findMany(
            {
                where: inArray(pushTokensTable.wallet, wallets),
            }
        );
        if (tokens.length === 0) {
            log.debug(
                "[NotificationsService] No push tokens found for the given wallets"
            );
            return;
        }

        // Set the vapid details for the notification
        setVapidDetails(
            "mailto:hello@frak.id",
            process.env.VAPID_PUBLIC_KEY as string,
            process.env.VAPID_PRIVATE_KEY as string
        );

        // Send all the notification in parallel, by batch of 30
        await parallel(30, tokens, async (token) => {
            try {
                await sendNotification(
                    {
                        endpoint: token.endpoint,
                        keys: {
                            p256dh: token.keyP256dh,
                            auth: token.keyAuth,
                        },
                    },
                    JSON.stringify(payload)
                );
            } catch (e) {
                log.warn(
                    { error: e },
                    "[NotificationsService] Error sending notification"
                );
            }
        });
    }

    /**
     * Cleanup expired notification tokens
     */
    async cleanupExpiredTokens() {
        await this.notificationDb
            .delete(pushTokensTable)
            .where(lt(pushTokensTable.expireAt, new Date()))
            .execute();
    }
}
