import { log } from "@backend-infrastructure";
import type { Address } from "viem";
import type {
    LocalisedNotificationPayload,
    SendNotificationPayload,
} from "../domain/notifications/dto/SendNotificationDto";
import type { NotificationsService } from "../domain/notifications/services/NotificationsService";

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

export type NotificationTemplate =
    | { type: "reward_pending"; merchantName: string; rewardCount: number }
    | { type: "reward_settled"; merchantName: string; rewardCount: number }
    | {
          type: "promotional";
          title: string;
          body: string;
          broadcastId?: string;
      };

export class NotificationOrchestrator {
    constructor(private readonly notificationsService: NotificationsService) {}

    async sendNotifications(
        notifications: {
            wallets: Address[];
            template: NotificationTemplate;
        }[]
    ) {
        for (const { wallets, template } of notifications) {
            if (wallets.length === 0) continue;

            const broadcastId =
                template.type === "promotional"
                    ? template.broadcastId
                    : undefined;

            const payload = this.resolvePayload(template);

            try {
                await this.notificationsService.sendAndStore({
                    wallets,
                    payload,
                    type: template.type,
                    broadcastId,
                });
            } catch (error) {
                log.warn(
                    { error, type: template.type, walletCount: wallets.length },
                    "[NotificationOrchestrator] Failed to send notification"
                );
            }
        }
    }

    private resolvePayload(
        template: NotificationTemplate
    ): SendNotificationPayload | LocalisedNotificationPayload {
        if (template.type === "promotional") {
            return {
                title: template.title,
                body: template.body,
                data: { url: this.resolveUrl(template) },
            };
        }

        switch (template.type) {
            case "reward_pending": {
                return notificationMessages.reward_pending(
                    template.merchantName,
                    template.rewardCount
                );
            }
            case "reward_settled": {
                return notificationMessages.reward_settled(
                    template.merchantName,
                    template.rewardCount
                );
            }
        }
    }

    private resolveUrl(template: NotificationTemplate): string {
        switch (template.type) {
            case "reward_pending":
            case "reward_settled":
            case "promotional":
                return "https://wallet.frak.id/";
        }
    }
}
