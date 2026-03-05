import { db, log } from "@backend-infrastructure";
import { inArray, lt } from "drizzle-orm";
import type { Address } from "viem";
import { sendNotification, setVapidDetails } from "web-push";
import { pushTokensTable } from "../db/schema";
import type { SendNotificationPayload } from "../dto/SendNotificationDto";
import type { FcmSender } from "./FcmSender";

type PushToken = typeof pushTokensTable.$inferSelect;

export class NotificationsService {
    constructor(readonly fcmSender: FcmSender) {}

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

        const { webPushTokens, fcmTokens } = this.partitionByType(tokens);

        const results = await Promise.allSettled([
            this.sendWebPush(webPushTokens, payload),
            this.sendFcm(fcmTokens, payload),
        ]);

        for (const result of results) {
            if (result.status === "rejected") {
                log.warn(
                    { error: result.reason },
                    "[NotificationsService] Sender failed"
                );
            }
        }
    }

    private partitionByType(tokens: PushToken[]) {
        const webPushTokens: PushToken[] = [];
        const fcmTokens: PushToken[] = [];

        for (const token of tokens) {
            if (token.type === "fcm") {
                fcmTokens.push(token);
            } else {
                webPushTokens.push(token);
            }
        }

        return { webPushTokens, fcmTokens };
    }

    private async sendWebPush(
        tokens: PushToken[],
        payload: SendNotificationPayload
    ) {
        if (tokens.length === 0) return;

        setVapidDetails(
            "mailto:hello@frak.id",
            process.env.VAPID_PUBLIC_KEY as string,
            process.env.VAPID_PRIVATE_KEY as string
        );

        const chunks = this.chunk(tokens, 30);
        for (const chunk of chunks) {
            const worker = chunk.map(async (token) => {
                try {
                    await sendNotification(
                        {
                            endpoint: token.endpoint,
                            keys: {
                                p256dh: token.keyP256dh ?? "",
                                auth: token.keyAuth ?? "",
                            },
                        },
                        JSON.stringify(payload)
                    );
                } catch (error) {
                    log.warn(
                        { error },
                        "[NotificationsService] Web push send error"
                    );
                }
            });
            await Promise.allSettled(worker);
        }
    }

    private async sendFcm(
        tokens: PushToken[],
        payload: SendNotificationPayload
    ) {
        if (tokens.length === 0) return;

        const fcmRegistrationTokens = tokens.map((t) => t.endpoint);
        const invalidTokens = await this.fcmSender.send({
            tokens: fcmRegistrationTokens,
            payload,
        });

        if (invalidTokens.length > 0) {
            await this.deleteTokensByEndpoint(invalidTokens);
        }
    }

    async cleanupExpiredTokens() {
        await db
            .delete(pushTokensTable)
            .where(lt(pushTokensTable.expireAt, new Date()))
            .execute();
    }

    private async deleteTokensByEndpoint(endpoints: string[]) {
        await db
            .delete(pushTokensTable)
            .where(inArray(pushTokensTable.endpoint, endpoints))
            .execute();
    }

    private chunk<T>(array: T[], size: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }
}
