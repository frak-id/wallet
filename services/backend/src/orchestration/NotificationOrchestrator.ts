import { log } from "@backend-infrastructure";
import type { Address } from "viem";
import type { NotificationsService } from "../domain/notifications/services/NotificationsService";

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

            const { title, body } = this.resolveContent(template);
            const broadcastId =
                template.type === "promotional"
                    ? template.broadcastId
                    : undefined;

            try {
                await this.notificationsService.sendAndStore({
                    wallets,
                    payload: {
                        title,
                        body,
                        data: { url: this.resolveUrl(template) },
                    },
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

    private resolveContent(template: NotificationTemplate): {
        title: string;
        body: string;
    } {
        switch (template.type) {
            case "reward_pending":
                return {
                    title: "New reward pending!",
                    body:
                        template.rewardCount === 1
                            ? `You've earned a reward from ${template.merchantName}.`
                            : `You've earned ${template.rewardCount} rewards from ${template.merchantName}.`,
                };
            case "reward_settled":
                return {
                    title: "Reward settled!",
                    body:
                        template.rewardCount === 1
                            ? `Your reward from ${template.merchantName} has been sent to your wallet.`
                            : `${template.rewardCount} rewards from ${template.merchantName} have been sent to your wallet.`,
                };
            case "promotional":
                return { title: template.title, body: template.body };
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
