import { eventEmitter, log, productEvents } from "@backend-infrastructure";
import type {
    MerchantWebhook,
    PurchaseRepository,
    PurchaseSelect,
    PurchaseSubscription,
    ResolvedSubscriptionOrder,
} from "../domain/purchases";
import { SubscriptionAuthError } from "../domain/purchases";
import type { SubscriptionConnectionService } from "../domain/purchases/services/SubscriptionConnectionService";
import type { InteractionLogRepository } from "../domain/rewards/repositories/InteractionLogRepository";
import type { PurchaseInteractionCreator } from "./PurchaseInteractionCreator";
import { toInteractionSubscription } from "./subscriptionInteraction";

const GIVE_UP_AFTER_MS = 24 * 60 * 60 * 1000;
const BACKOFF_BASE_MS = 60 * 1000;
const BACKOFF_CAP_MS = 2 * 60 * 60 * 1000;

type ResolutionOutcome = "resolved" | "retry" | "unresolved";

export type ResolutionBatchResult = Record<ResolutionOutcome, number>;

function backoffMs(attempts: number): number {
    return Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** (attempts - 1));
}

/**
 * Classifies pending subscription orders with the merchant's provider and
 * applies the answer to the order's interaction, creating one for a renewal.
 */
export class SubscriptionResolutionOrchestrator {
    constructor(
        private readonly purchaseRepository: PurchaseRepository,
        private readonly connectionService: SubscriptionConnectionService,
        private readonly interactionLogRepository: InteractionLogRepository,
        private readonly purchaseInteractionCreator: PurchaseInteractionCreator
    ) {}

    async resolveDue(options: {
        limit: number;
        now?: Date;
    }): Promise<ResolutionBatchResult> {
        const now = options.now ?? new Date();
        const result: ResolutionBatchResult = {
            resolved: 0,
            retry: 0,
            unresolved: 0,
        };
        const due =
            await this.purchaseRepository.findDueSubscriptionResolutions(
                now,
                options.limit
            );
        if (due.length === 0) return result;

        const webhooks = new Map(
            (
                await this.purchaseRepository.findWebhooksByIds([
                    ...new Set(due.map((purchase) => purchase.webhookId)),
                ])
            ).map((webhook) => [webhook.id, webhook])
        );

        for (const purchase of due) {
            const webhook = webhooks.get(purchase.webhookId);
            try {
                result[await this.resolveOne(purchase, webhook, now)]++;
            } catch (err) {
                log.error(
                    { err, purchaseId: purchase.id },
                    "Subscription resolution failed"
                );
            }
        }
        return result;
    }

    private async resolveOne(
        purchase: PurchaseSelect,
        webhook: MerchantWebhook | undefined,
        now: Date
    ): Promise<ResolutionOutcome> {
        const pending = purchase.subscription;
        if (!pending) return "unresolved";
        if (!webhook) {
            await this.purchaseRepository.updateSubscription(purchase.id, {
                state: "unresolved",
                attempts: pending.attempts,
                nextAttemptAt: null,
            });
            return "unresolved";
        }

        const answer = await this.ask(purchase, webhook);
        if (answer === "retry") {
            return this.retryOrGiveUp(purchase, webhook, pending, now);
        }
        if (answer === "disconnected") {
            await this.giveUp(purchase, webhook, pending);
            return "unresolved";
        }

        const resolved: PurchaseSubscription = {
            state: "resolved",
            attempts: pending.attempts,
            nextAttemptAt: null,
            kind: answer.kind,
            providerSubscriptionIds: answer.providerSubscriptionIds,
            cyclesCovered: answer.cyclesCovered,
            merchandiseAmount: answer.merchandiseAmount,
        };
        await this.purchaseRepository.updateSubscription(purchase.id, resolved);
        productEvents.track("subscription_order_resolved", null, {
            kind: answer.kind,
            provider: webhook.subscriptionProvider ?? "unknown",
        });
        await this.apply(purchase, webhook, resolved);
        return "resolved";
    }

    private async ask(
        purchase: PurchaseSelect,
        webhook: MerchantWebhook
    ): Promise<ResolvedSubscriptionOrder | "retry" | "disconnected"> {
        const connected = await this.connectionService.resolveProvider(webhook);
        if (!connected) return "disconnected";
        try {
            return await connected.resolver.resolve(
                { externalId: purchase.externalId },
                connected.token
            );
        } catch (err) {
            if (err instanceof SubscriptionAuthError) {
                await this.connectionService.recordAuthError(webhook);
            } else {
                log.warn({ err, purchaseId: purchase.id }, "Resolver failed");
            }
            return "retry";
        }
    }

    private async retryOrGiveUp(
        purchase: PurchaseSelect,
        webhook: MerchantWebhook,
        pending: PurchaseSubscription,
        now: Date
    ): Promise<ResolutionOutcome> {
        const attempts = pending.attempts + 1;
        const age = now.getTime() - (purchase.createdAt?.getTime() ?? 0);
        if (age >= GIVE_UP_AFTER_MS) {
            await this.giveUp(purchase, webhook, { ...pending, attempts });
            return "unresolved";
        }
        await this.purchaseRepository.updateSubscription(purchase.id, {
            ...pending,
            attempts,
            nextAttemptAt: new Date(
                now.getTime() + backoffMs(attempts)
            ).toISOString(),
        });
        return "retry";
    }

    private async giveUp(
        purchase: PurchaseSelect,
        webhook: MerchantWebhook,
        pending: PurchaseSubscription
    ): Promise<void> {
        await this.purchaseRepository.updateSubscription(purchase.id, {
            state: "unresolved",
            attempts: pending.attempts,
            nextAttemptAt: null,
        });
        await this.dropSubscription(purchase, webhook.merchantId);
    }

    private async apply(
        purchase: PurchaseSelect,
        webhook: MerchantWebhook,
        resolved: PurchaseSubscription
    ): Promise<void> {
        switch (resolved.kind) {
            case "checkout":
                await this.updateInteraction(purchase, webhook, resolved);
                return;
            case "renewal":
                if (
                    !(await this.updateInteraction(purchase, webhook, resolved))
                ) {
                    await this.createRenewalInteraction(
                        purchase,
                        webhook,
                        resolved
                    );
                }
                return;
            case "prepaid_shipment":
                await this.updateInteraction(purchase, webhook, resolved, true);
                return;
            default:
                await this.dropSubscription(purchase, webhook.merchantId);
        }
    }

    private async findInteraction(
        purchase: PurchaseSelect,
        merchantId: string
    ) {
        return this.interactionLogRepository.findPurchaseByExternalId({
            merchantId,
            externalId: purchase.externalId,
        });
    }

    /** True when the order already had an interaction waiting on this answer. */
    private async updateInteraction(
        purchase: PurchaseSelect,
        webhook: MerchantWebhook,
        resolved: PurchaseSubscription,
        close = false
    ): Promise<boolean> {
        const interaction = await this.findInteraction(
            purchase,
            webhook.merchantId
        );
        if (!interaction) return false;
        const updated =
            await this.interactionLogRepository.setPurchaseSubscription(
                interaction.id,
                toInteractionSubscription(resolved) ?? null,
                { close }
            );
        if (updated && !close) eventEmitter.emit("newInteraction");
        return true;
    }

    private async dropSubscription(
        purchase: PurchaseSelect,
        merchantId: string
    ): Promise<void> {
        const interaction = await this.findInteraction(purchase, merchantId);
        if (!interaction) return;
        const updated =
            await this.interactionLogRepository.setPurchaseSubscription(
                interaction.id,
                null
            );
        if (updated) eventEmitter.emit("newInteraction");
    }

    /** A renewal has no checkout of its own: it belongs to whoever already holds the subscription. */
    private async createRenewalInteraction(
        purchase: PurchaseSelect,
        webhook: MerchantWebhook,
        resolved: PurchaseSubscription
    ): Promise<void> {
        const identityGroupId =
            purchase.identityGroupId ??
            (await this.findSubscriberIdentity(purchase, webhook, resolved));
        if (!identityGroupId) {
            log.info(
                { purchaseId: purchase.id },
                "Renewal without a known subscriber, dropped"
            );
            return;
        }
        if (!purchase.identityGroupId) {
            await this.purchaseRepository.updateIdentityGroup(
                purchase.id,
                identityGroupId,
                null
            );
        }
        await this.purchaseInteractionCreator.create({
            purchaseId: purchase.id,
            externalId: purchase.externalId,
            externalCustomerId: purchase.externalCustomerId,
            totalPrice: purchase.totalPrice,
            currencyCode: purchase.currencyCode,
            items: await this.purchaseRepository.findItemsByPurchaseId(
                purchase.id
            ),
            identityGroupId,
            merchantId: webhook.merchantId,
            cancelled:
                purchase.status === "refunded" ||
                purchase.status === "cancelled",
            subscription: resolved,
        });
    }

    /** The order of the same provider subscription, else the customer's latest linked one. */
    private async findSubscriberIdentity(
        purchase: PurchaseSelect,
        webhook: MerchantWebhook,
        resolved: PurchaseSubscription
    ): Promise<string | null> {
        const linked = (
            await this.purchaseRepository.findLinkedSubscriptionOrders({
                webhookId: webhook.id,
                externalCustomerId: purchase.externalCustomerId,
            })
        ).filter((order) => order.id !== purchase.id);

        const ids = new Set(resolved.providerSubscriptionIds ?? []);
        const sameSubscription = linked.find((order) =>
            order.subscription?.providerSubscriptionIds?.some((id) =>
                ids.has(id)
            )
        );
        return (sameSubscription ?? linked[0])?.identityGroupId ?? null;
    }
}
