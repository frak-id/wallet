import { db, log } from "@backend-infrastructure";
import type { Language } from "@frak-labs/core-sdk";
import { inArray, lt } from "drizzle-orm";
import type { Address } from "viem";
import { sendNotification, setVapidDetails } from "web-push";
import { notificationSentTable, pushTokensTable } from "../db/schema";
import type {
    LocalisedNotificationPayload,
    SendNotificationPayload,
} from "../dto/SendNotificationDto";
import type { NotificationType } from "../schemas";
import type { FcmSender } from "./FcmSender";

type PushToken = typeof pushTokensTable.$inferSelect;

/** Web push token with guaranteed non-null crypto keys */
type WebPushToken = PushToken & { keyP256dh: string; keyAuth: string };

type NotificationPayload =
    | SendNotificationPayload
    | LocalisedNotificationPayload;

function isValidWebPushToken(token: PushToken): token is WebPushToken {
    return token.keyP256dh !== null && token.keyAuth !== null;
}

/** Status codes indicating a permanently dead web-push subscription */
function isGoneStatus(statusCode: number): boolean {
    return statusCode === 404 || statusCode === 410;
}

function isLocalisedPayload(
    payload: NotificationPayload
): payload is LocalisedNotificationPayload {
    return !("title" in payload);
}

function resolvePayload(
    payload: NotificationPayload,
    locale: Language
): SendNotificationPayload {
    if (!isLocalisedPayload(payload)) return payload;
    return payload[locale] ?? Object.values(payload)[0];
}

export class NotificationsService {
    constructor(readonly fcmSender: FcmSender) {}

    async sendNotification({
        wallets,
        payload,
    }: {
        wallets: Address[];
        payload: NotificationPayload;
    }) {
        const tokens = await this.fetchTokens(wallets);
        if (tokens.length === 0) {
            log.debug(
                "[NotificationsService] No push tokens found for the given wallets"
            );
            return;
        }

        await this.sendToTokens(tokens, payload);
    }

    async sendAndStore({
        wallets,
        payload,
        type,
        broadcastId,
    }: {
        wallets: Address[];
        payload: NotificationPayload;
        type: NotificationType;
        broadcastId?: string;
    }) {
        if (wallets.length === 0) return;

        const tokens = await this.fetchTokens(wallets);

        if (tokens.length === 0) return;

        await this.sendToTokens(tokens, payload);

        const walletLocale = new Map<Address, Language>();
        for (const token of tokens) {
            if (!walletLocale.has(token.wallet)) {
                walletLocale.set(token.wallet, token.locale);
            }
        }

        const records = wallets.map((wallet) => {
            const resolved = resolvePayload(
                payload,
                walletLocale.get(wallet) ?? "fr"
            );
            return {
                wallet,
                type,
                title: resolved.title,
                body: resolved.body,
                payload: resolved,
                broadcastId,
            };
        });

        try {
            await db.insert(notificationSentTable).values(records);
        } catch (error) {
            log.warn(
                { error, count: records.length },
                "[NotificationsService] Failed to store sent notifications"
            );
        }
    }

    async cleanupExpiredTokens() {
        await db
            .delete(pushTokensTable)
            .where(lt(pushTokensTable.expireAt, new Date()))
            .execute();
    }

    private async fetchTokens(wallets: Address[]): Promise<PushToken[]> {
        return db.query.pushTokensTable.findMany({
            where: inArray(pushTokensTable.wallet, wallets),
        });
    }

    private async sendToTokens(
        tokens: PushToken[],
        payload: NotificationPayload
    ) {
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
        payload: NotificationPayload
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
                const resolved = resolvePayload(payload, token.locale);
                try {
                    await sendNotification(
                        {
                            endpoint: token.endpoint,
                            keys: {
                                p256dh: token.keyP256dh,
                                auth: token.keyAuth,
                            },
                        },
                        JSON.stringify(resolved)
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

    private async sendFcm(tokens: PushToken[], payload: NotificationPayload) {
        if (tokens.length === 0) return;

        const endpointToId = new Map<string, number>();
        for (const token of tokens) {
            endpointToId.set(token.endpoint, token.id);
        }

        const allInvalidEndpoints: string[] = [];

        if (isLocalisedPayload(payload)) {
            const byLocale = new Map<string, string[]>();
            for (const token of tokens) {
                const group = byLocale.get(token.locale) ?? [];
                group.push(token.endpoint);
                byLocale.set(token.locale, group);
            }

            for (const [locale, endpoints] of byLocale) {
                const resolved = resolvePayload(payload, locale);
                const invalid = await this.fcmSender.send({
                    tokens: endpoints,
                    payload: resolved,
                });
                allInvalidEndpoints.push(...invalid);
            }
        } else {
            const invalid = await this.fcmSender.send({
                tokens: tokens.map((t) => t.endpoint),
                payload,
            });
            allInvalidEndpoints.push(...invalid);
        }

        if (allInvalidEndpoints.length > 0) {
            const idsToDelete = allInvalidEndpoints
                .map((ep) => endpointToId.get(ep))
                .filter((id): id is number => id !== undefined);

            if (idsToDelete.length > 0) {
                await this.deleteTokensByIds(idsToDelete);
            }
        }
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
