import type { SendNotificationPayload } from "@backend-domain/notifications";
import { eventEmitter, log } from "@backend-infrastructure";
import type { NotificationEvent, NotificationEventItem } from "@backend-utils";
import { isRunningInProd } from "@frak-labs/app-essentials";
import type { Address } from "viem";
import type { MerchantRepository } from "../domain/merchant/repositories/MerchantRepository";
import type { NotificationsService } from "../domain/notifications/services/NotificationsService";

// Stage-scoped wallet URL: prod backend points users at wallet.frak.id,
// dev backend points users at wallet-dev.frak.id (matches the dev app variant).
const walletNotificationUrl = isRunningInProd
    ? "https://wallet.frak.id/"
    : "https://wallet-dev.frak.id/";

const notificationMessages = {
    reward_pending: (merchantName: string, rewardCount: number) => ({
        en: {
            title: `${merchantName} rewarded you!`,
            body:
                rewardCount === 1
                    ? "Your reward is being processed."
                    : `${rewardCount} rewards are being processed.`,
        },
        fr: {
            title: `${merchantName} vous a récompensé !`,
            body:
                rewardCount === 1
                    ? "Votre récompense est en cours de traitement."
                    : `${rewardCount} récompenses sont en cours de traitement.`,
        },
    }),
    reward_settled: (merchantName: string, rewardCount: number) => ({
        en: {
            title: "Reward received!",
            body:
                rewardCount === 1
                    ? `Your reward from ${merchantName} is in your wallet.`
                    : `${rewardCount} rewards from ${merchantName} are in your wallet.`,
        },
        fr: {
            title: "Récompense reçue !",
            body:
                rewardCount === 1
                    ? `Votre récompense de ${merchantName} est dans votre portefeuille.`
                    : `${rewardCount} récompenses de ${merchantName} sont dans votre portefeuille.`,
        },
    }),
} as const;

export class NotificationOrchestrator {
    constructor(
        private readonly notificationsService: NotificationsService,
        private readonly merchantRepository: MerchantRepository
    ) {}

    registerListeners() {
        eventEmitter.on("notification", (event) =>
            this.handleNotificationEvent(event)
        );
    }

    async sendPromotionalNotification(params: {
        wallets: Address[];
        payload: SendNotificationPayload;
        broadcastId?: string;
    }) {
        const { wallets, broadcastId, payload } = params;
        if (wallets.length === 0) return;

        try {
            await this.notificationsService.sendAndStore({
                wallets,
                payload: {
                    ...payload,
                    data: { url: walletNotificationUrl },
                },
                type: "promotional",
                broadcastId,
            });
        } catch (error) {
            log.warn(
                { error, walletCount: wallets.length },
                "[NotificationOrchestrator] Failed to send promotional notification"
            );
        }
    }

    private async handleNotificationEvent(event: NotificationEvent) {
        const merchantNames = await this.resolveMerchantNames(
            event.notifications
        );

        for (const notification of event.notifications) {
            if (notification.wallets.length === 0) continue;

            const merchantName =
                merchantNames[notification.merchantId] ?? "a merchant";
            const payload = notificationMessages[event.type](
                merchantName,
                notification.rewardCount
            );

            try {
                await this.notificationsService.sendAndStore({
                    wallets: notification.wallets,
                    payload,
                    type: event.type,
                });
            } catch (error) {
                log.warn(
                    {
                        error,
                        type: event.type,
                        walletCount: notification.wallets.length,
                    },
                    "[NotificationOrchestrator] Failed to send notification"
                );
            }
        }
    }

    private async resolveMerchantNames(notifications: NotificationEventItem[]) {
        const merchantIds = [
            ...new Set(notifications.map((n) => n.merchantId)),
        ];

        // Find all the merchant per ids
        const merchants = await this.merchantRepository.findByIds(merchantIds);

        // Map that to the record we want to use
        return merchants.reduce(
            (acc, current) => {
                acc[current.id] = current.name;
                return acc;
            },
            {} as Record<string, string>
        );
    }
}
