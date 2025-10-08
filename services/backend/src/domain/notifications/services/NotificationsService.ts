import { db } from "@backend-common";
import { inArray, lt } from "drizzle-orm";
import type { Address } from "viem";
import { sendNotification, setVapidDetails } from "web-push";
import { log } from "../../../common";
import { pushTokensTable } from "../db/schema";
import type { SendNotificationPayload } from "../dto/SendNotificationDto";

type PushToken = typeof pushTokensTable.$inferSelect;

export class NotificationsService {
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
        const tokens = await db.query.pushTokensTable.findMany({
            where: inArray(pushTokensTable.wallet, wallets),
        });
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

        // Send all the notification in chunks
        try {
            await this.sendNotificationChunked(tokens, payload);
        } catch (error) {
            log.warn(
                { error },
                "[NotificationsService] Error sending notification"
            );
        }
    }

    /**
     * Send a notification to a list of wallets in chunks of 30
     * @param tokens - The tokens to send the notification to
     * @param payload - The payload to send
     */
    private async sendNotificationChunked(
        tokens: PushToken[],
        payload: SendNotificationPayload
    ) {
        // Create chunks of 30 tokens
        const chunks = tokens.reduce((acc, token, index) => {
            const chunkIndex = Math.floor(index / 30);
            if (!acc[chunkIndex]) {
                acc[chunkIndex] = [];
            }
            acc[chunkIndex].push(token);
            return acc;
        }, [] as PushToken[][]);

        // Iterate over each chunk to send the notification
        for (const chunk of chunks) {
            const worker = chunk.map(async (token) => {
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
                } catch (error) {
                    log.warn(
                        { error },
                        "[NotificationsService] Error sending notification"
                    );
                }
            });
            await Promise.allSettled(worker);
        }
    }

    /**
     * Cleanup expired notification tokens
     */
    async cleanupExpiredTokens() {
        await db
            .delete(pushTokensTable)
            .where(lt(pushTokensTable.expireAt, new Date()))
            .execute();
    }
}
