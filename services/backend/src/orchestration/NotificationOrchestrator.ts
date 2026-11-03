import type {
    LocalisedNotificationPayload,
    SendNotificationPayload,
    SendNotificationTargets,
} from "@backend-domain/notifications";
import { eventEmitter, log } from "@backend-infrastructure";
import { isRunningInProd } from "@frak-labs/app-essentials";
import type { Address } from "viem";
import type { MerchantRepository } from "../domain/merchant/repositories/MerchantRepository";
import type {
    NotificationEvent,
    NotificationEventItem,
} from "../domain/notifications/events";
import type { NotificationBroadcastRepository } from "../domain/notifications/repositories/NotificationBroadcastRepository";
import type { NotificationsService } from "../domain/notifications/services/NotificationsService";
import type { MemberQueryOrchestrator } from "./MemberQueryOrchestrator";

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
                    ? `Votre récompense de ${merchantName} est dans votre porte-monnaie.`
                    : `${rewardCount} récompenses de ${merchantName} sont dans votre porte-monnaie.`,
        },
    }),
} as const;

function formatEuros(amount: number, locale: string) {
    const digits = Number.isInteger(amount) ? 0 : 2;
    return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    }).format(amount);
}

function gameWonMessage(prizeAmount: number) {
    const data = { url: walletNotificationUrl };
    return {
        en: {
            title: "You won the Frak Game!",
            body: `Your ${formatEuros(prizeAmount, "en")} prize is on its way to your wallet.`,
            data,
        },
        fr: {
            title: "Tu as gagné le Jeu Frak !",
            body: `Tes ${formatEuros(prizeAmount, "fr")} arrivent dans ton porte-monnaie.`,
            data,
        },
    };
}

/** Players are in France: the deadline reads in Paris time whatever the server's zone. */
function formatDeadline(at: Date, locale: string) {
    return new Intl.DateTimeFormat(locale, {
        timeZone: "Europe/Paris",
        day: "numeric",
        month: "long",
        hour: "numeric",
        minute: "2-digit",
    }).format(at);
}

function gameCandidateMessage(
    kind: "game_candidate_drawn" | "game_candidate_reminder",
    prizeAmount: number,
    verifyBy: Date
) {
    const data = { url: walletNotificationUrl };
    const en = {
        prize: formatEuros(prizeAmount, "en"),
        by: formatDeadline(verifyBy, "en"),
    };
    const fr = {
        prize: formatEuros(prizeAmount, "fr"),
        by: formatDeadline(verifyBy, "fr"),
    };
    if (kind === "game_candidate_drawn") {
        return {
            en: {
                title: "You were drawn in the Frak Game!",
                body: `Connect your Instagram before ${en.by} to receive your ${en.prize}.`,
                data,
            },
            fr: {
                title: "Tu as été tiré au sort au Jeu Frak !",
                body: `Connecte ton Instagram avant le ${fr.by} pour recevoir tes ${fr.prize}.`,
                data,
            },
        };
    }
    return {
        en: {
            title: "A few hours left to claim your prize",
            body: `Connect your Instagram before ${en.by}, or another winner is drawn.`,
            data,
        },
        fr: {
            title: "Plus que quelques heures pour ton gain",
            body: `Connecte ton Instagram avant le ${fr.by}, sinon un autre gagnant est tiré au sort.`,
            data,
        },
    };
}

export class NotificationOrchestrator {
    constructor(
        private readonly notificationsService: NotificationsService,
        private readonly merchantRepository: MerchantRepository,
        private readonly notificationBroadcastRepository: NotificationBroadcastRepository,
        private readonly memberQueryOrchestrator: MemberQueryOrchestrator
    ) {}

    registerListeners() {
        eventEmitter.on("notification", (event) =>
            this.handleNotificationEvent(event)
        );
    }

    async resolveWalletsFromTargets(
        targets: SendNotificationTargets,
        merchantId: string
    ): Promise<Address[]> {
        if ("wallets" in targets) {
            return targets.wallets;
        }

        // Scope filter-based resolution to the broadcasting merchant: a broadcast
        // maps to a single merchant and the cron has no session to widen that, so
        // a merchant can only ever reach its own members.
        return this.memberQueryOrchestrator.resolveWallets(
            [merchantId],
            targets.filter
        );
    }

    async processDueScheduledNotifications() {
        const due =
            await this.notificationBroadcastRepository.claimDueScheduled(
                new Date()
            );

        // Isolate each broadcast: a failure resolving one audience (a DB query
        // that can throw) must not abort the batch and strand the remaining
        // already-claimed rows unsent.
        for (const broadcast of due) {
            try {
                const wallets = broadcast.targets
                    ? await this.resolveWalletsFromTargets(
                          broadcast.targets,
                          broadcast.merchantId
                      )
                    : [];
                await this.sendPromotionalNotification({
                    wallets,
                    payload: broadcast.payload,
                    broadcastId: broadcast.id,
                });
            } catch (error) {
                log.warn(
                    { error, broadcastId: broadcast.id },
                    "[NotificationOrchestrator] Failed to process scheduled broadcast"
                );
            }
        }
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
        if (event.type === "game_won") {
            await this.send(
                [event.wallet],
                gameWonMessage(event.prizeAmount),
                event.type
            );
            return;
        }
        if (
            event.type === "game_candidate_drawn" ||
            event.type === "game_candidate_reminder"
        ) {
            await this.send(
                [event.wallet],
                gameCandidateMessage(
                    event.type,
                    event.prizeAmount,
                    event.verifyBy
                ),
                event.type
            );
            return;
        }

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
            await this.send(notification.wallets, payload, event.type);
        }
    }

    private async send(
        wallets: Address[],
        payload: LocalisedNotificationPayload,
        type: NotificationEvent["type"]
    ) {
        try {
            await this.notificationsService.sendAndStore({
                wallets,
                payload,
                type,
            });
        } catch (error) {
            log.warn(
                { error, type, walletCount: wallets.length },
                "[NotificationOrchestrator] Failed to send notification"
            );
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
