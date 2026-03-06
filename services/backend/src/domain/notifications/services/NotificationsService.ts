import { db, log } from "@backend-infrastructure";
import { inArray, lt } from "drizzle-orm";
import type { Address } from "viem";
import { sendNotification, setVapidDetails } from "web-push";
import { pushTokensTable } from "../db/schema";
import type { SendNotificationPayload } from "../dto/SendNotificationDto";
import type { FcmSender } from "./FcmSender";

type PushToken = typeof pushTokensTable.$inferSelect;

/** Web push token with guaranteed non-null crypto keys */
type WebPushToken = PushToken & { keyP256dh: string; keyAuth: string };

function isValidWebPushToken(token: PushToken): token is WebPushToken {
    return token.keyP256dh !== null && token.keyAuth !== null;
}

/** Status codes indicating a permanently dead web-push subscription */
function isGoneStatus(statusCode: number): boolean {
    return statusCode === 404 || statusCode === 410;
}

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
        const webPushTokens: WebPushToken[] = [];
        const fcmTokens: PushToken[] = [];

        for (const token of tokens) {
            if (token.type === "fcm") {
                fcmTokens.push(token);
            } else if (isValidWebPushToken(token)) {
                webPushTokens.push(token);
            } else {
                log.warn(
                    { endpoint: token.endpoint },
                    "[NotificationsService] Skipping web-push token with missing keys"
                );
            }
        }

        return { webPushTokens, fcmTokens };
    }

    private async sendWebPush(
        tokens: WebPushToken[],
        payload: SendNotificationPayload
    ) {
        if (tokens.length === 0) return;

        const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
        const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
        if (!vapidPublicKey || !vapidPrivateKey) {
            log.warn(
                "[NotificationsService] VAPID keys not configured, skipping web push"
            );
            return;
        }

        setVapidDetails(
            "mailto:hello@frak.id",
            vapidPublicKey,
            vapidPrivateKey
        );

        const staleTokenIds: number[] = [];

        const chunks = this.chunk(tokens, 30);
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
                } catch (error: unknown) {
                    const statusCode =
                        error instanceof Error &&
                        "statusCode" in error &&
                        typeof (error as { statusCode: unknown }).statusCode ===
                            "number"
                            ? (error as { statusCode: number }).statusCode
                            : undefined;

                    if (statusCode && isGoneStatus(statusCode)) {
                        staleTokenIds.push(token.id);
                    } else {
                        log.warn(
                            { error },
                            "[NotificationsService] Web push send error"
                        );
                    }
                }
            });
            await Promise.allSettled(worker);
        }

        if (staleTokenIds.length > 0) {
            log.info(
                { count: staleTokenIds.length },
                "[NotificationsService] Cleaning up stale web-push tokens"
            );
            await this.deleteTokensByIds(staleTokenIds);
        }
    }

    private async sendFcm(
        tokens: PushToken[],
        payload: SendNotificationPayload
    ) {
        if (tokens.length === 0) return;

        // Build endpoint → row id map for scoped cleanup
        const endpointToId = new Map<string, number>();
        for (const token of tokens) {
            endpointToId.set(token.endpoint, token.id);
        }

        const invalidEndpoints = await this.fcmSender.send({
            tokens: tokens.map((t) => t.endpoint),
            payload,
        });

        if (invalidEndpoints.length > 0) {
            const idsToDelete = invalidEndpoints
                .map((ep) => endpointToId.get(ep))
                .filter((id): id is number => id !== undefined);

            if (idsToDelete.length > 0) {
                await this.deleteTokensByIds(idsToDelete);
            }
        }
    }

    async cleanupExpiredTokens() {
        await db
            .delete(pushTokensTable)
            .where(lt(pushTokensTable.expireAt, new Date()))
            .execute();
    }

    private async deleteTokensByIds(ids: number[]) {
        await db
            .delete(pushTokensTable)
            .where(inArray(pushTokensTable.id, ids))
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
