import { eventEmitter, log, productEvents } from "@backend-infrastructure";
import type {
    MerchantWebhook,
    PurchaseRepository,
    PurchaseSelect,
    PurchaseSubscription,
    ResolvedSubscriptionOrder,
} from "../domain/purchases";
import {
    SubscriptionAuthError,
    SubscriptionRateLimitError,
    SubscriptionUnavailableError,
} from "../domain/purchases";
import type {
    ConnectedProvider,
    SubscriptionConnectionService,
} from "../domain/purchases/services/SubscriptionConnectionService";
import type { AssetLogRepository } from "../domain/rewards/repositories/AssetLogRepository";
import type { InteractionLogRepository } from "../domain/rewards/repositories/InteractionLogRepository";
import type { PurchaseInteractionCreator } from "./PurchaseInteractionCreator";
import { toInteractionSubscription } from "./subscriptionInteraction";

const GIVE_UP_AFTER_MS = 24 * 60 * 60 * 1000;
const BACKOFF_BASE_MS = 60 * 1000;
const BACKOFF_CAP_MS = 2 * 60 * 60 * 1000;
const RUN_BUDGET_MS = 45 * 1000;
const WINDOW_FACTOR = 4;

/**
 * `skipped`: no reward can follow from the order yet, so the provider was not
 * asked. `throttled`: the provider rate-limited the token, the order stays due.
 */
type ResolutionOutcome =
    | "resolved"
    | "retry"
    | "unresolved"
    | "skipped"
    | "throttled";

type ResolutionBatchResult = Record<ResolutionOutcome, number> & {
    dropped: number;
};

/** Why the rest of a webhook's orders are not sent to the provider in this run. */
type WebhookBlock = { kind: "throttled" } | { kind: "unavailable" };

type Connection = ConnectedProvider | "auth_error" | null;

/** Per-run state: webhook blocks and memoised lookups shared by the batch's orders. */
type RunContext = {
    now: Date;
    webhooks: Map<number, MerchantWebhook>;
    remaining: Map<number, PurchaseSelect[]>;
    blocked: Map<number, WebhookBlock>;
    connections: Map<number, Promise<Connection>>;
    linked: Map<string, Promise<PurchaseSelect[]>>;
    plans: Map<string, Promise<boolean>>;
};

function backoffMs(attempts: number): number {
    return Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** (attempts - 1));
}

/** Oldest first, at most half the batch per webhook so one merchant's backlog cannot fill it. */
function pickBatch(window: PurchaseSelect[], limit: number): PurchaseSelect[] {
    const cap = Math.max(1, Math.ceil(limit / 2));
    const counts = new Map<number, number>();
    const batch: PurchaseSelect[] = [];
    for (const purchase of window) {
        if (batch.length >= limit) break;
        const count = counts.get(purchase.webhookId) ?? 0;
        if (count >= cap) continue;
        counts.set(purchase.webhookId, count + 1);
        batch.push(purchase);
    }
    return batch;
}

function groupByWebhook(
    batch: PurchaseSelect[]
): Map<number, PurchaseSelect[]> {
    const groups = new Map<number, PurchaseSelect[]>();
    for (const purchase of batch) {
        const group = groups.get(purchase.webhookId) ?? [];
        group.push(purchase);
        groups.set(purchase.webhookId, group);
    }
    return groups;
}

function memoise<K, T>(
    cache: Map<K, Promise<T>>,
    key: K,
    load: () => Promise<T>
): Promise<T> {
    const cached = cache.get(key);
    if (cached) return cached;
    const loading = load();
    cache.set(key, loading);
    return loading;
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
        private readonly purchaseInteractionCreator: PurchaseInteractionCreator,
        private readonly assetLogRepository: AssetLogRepository
    ) {}

    async resolveDue(options: {
        limit: number;
    }): Promise<ResolutionBatchResult> {
        const now = new Date();
        const deadline = Date.now() + RUN_BUDGET_MS;
        const result: ResolutionBatchResult = {
            resolved: 0,
            retry: 0,
            unresolved: 0,
            skipped: 0,
            throttled: 0,
            dropped: await this.purchaseRepository.dropUnclaimedSubscriptions(
                new Date(now.getTime() - GIVE_UP_AFTER_MS)
            ),
        };
        const due = pickBatch(
            await this.purchaseRepository.findDueSubscriptionResolutions(
                now,
                options.limit * WINDOW_FACTOR
            ),
            options.limit
        );
        if (due.length === 0) return result;

        const context: RunContext = {
            now,
            webhooks: new Map(
                (
                    await this.purchaseRepository.findWebhooksByIds([
                        ...new Set(due.map((purchase) => purchase.webhookId)),
                    ])
                ).map((webhook) => [webhook.id, webhook])
            ),
            remaining: groupByWebhook(due),
            blocked: new Map(),
            connections: new Map(),
            linked: new Map(),
            plans: new Map(),
        };
        for (const purchase of due) {
            if (Date.now() >= deadline) break;
            context.remaining.get(purchase.webhookId)?.shift();
            result[await this.processOne(purchase, context)]++;
        }
        return result;
    }

    private async processOne(
        purchase: PurchaseSelect,
        context: RunContext
    ): Promise<ResolutionOutcome> {
        const webhook = context.webhooks.get(purchase.webhookId);
        try {
            const block = context.blocked.get(purchase.webhookId);
            if (block?.kind === "throttled") return "throttled";
            if (block && webhook && purchase.subscription) {
                const outcome = await this.retryOrGiveUp(
                    purchase,
                    webhook,
                    purchase.subscription,
                    context.now
                );
                return outcome === "retry" ? "skipped" : outcome;
            }
            return await this.resolveOne(purchase, webhook, context);
        } catch (err) {
            log.error(
                { err, purchaseId: purchase.id },
                "Subscription resolution failed"
            );
            return this.recover(purchase, webhook, context.now);
        }
    }

    /** A failing order must still age toward the give-up, or it would sit at the head of the queue forever. */
    private async recover(
        purchase: PurchaseSelect,
        webhook: MerchantWebhook | undefined,
        now: Date
    ): Promise<ResolutionOutcome> {
        try {
            if (!(webhook && purchase.subscription)) {
                await this.markUnresolved(
                    purchase,
                    purchase.subscription?.attempts ?? 0
                );
                return "unresolved";
            }
            return await this.retryOrGiveUp(
                purchase,
                webhook,
                purchase.subscription,
                now
            );
        } catch (err) {
            log.error(
                { err, purchaseId: purchase.id },
                "Subscription resolution recovery failed"
            );
            return "retry";
        }
    }

    private async resolveOne(
        purchase: PurchaseSelect,
        webhook: MerchantWebhook | undefined,
        context: RunContext
    ): Promise<ResolutionOutcome> {
        const pending = purchase.subscription;
        if (!pending) return "unresolved";
        if (!webhook) {
            await this.markUnresolved(purchase, pending.attempts);
            return "unresolved";
        }

        if (!(await this.canEarn(purchase, webhook, context))) {
            const outcome = await this.retryOrGiveUp(
                purchase,
                webhook,
                pending,
                context.now
            );
            return outcome === "retry" ? "skipped" : outcome;
        }

        const answer = await this.ask(purchase, webhook, context);
        if (answer === "throttled") return "throttled";
        if (answer === "retry") {
            return this.retryOrGiveUp(purchase, webhook, pending, context.now);
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
        // The reward is written before the order leaves the queue; apply is idempotent.
        await this.apply(purchase, webhook, resolved, context);
        await this.purchaseRepository.updateSubscription(purchase.id, resolved);
        productEvents.track("subscription_order_resolved", null, {
            kind: answer.kind,
            provider: webhook.subscriptionProvider ?? "unknown",
        });
        return "resolved";
    }

    private linkedOrders(
        webhook: MerchantWebhook,
        externalCustomerId: string,
        context: RunContext
    ): Promise<PurchaseSelect[]> {
        return memoise(
            context.linked,
            `${webhook.id}:${externalCustomerId}`,
            () =>
                this.purchaseRepository.findLinkedSubscriptionOrders({
                    webhookId: webhook.id,
                    externalCustomerId,
                })
        );
    }

    private holdsPlan(
        merchantId: string,
        group: string,
        context: RunContext
    ): Promise<boolean> {
        return memoise(context.plans, `${merchantId}:${group}`, () =>
            this.assetLogRepository.hasPlan(merchantId, group)
        );
    }

    /**
     * A linked order has an interaction a campaign may reward. An unlinked one
     * only matters as the renewal of a subscriber who holds a plan.
     */
    private async canEarn(
        purchase: PurchaseSelect,
        webhook: MerchantWebhook,
        context: RunContext
    ): Promise<boolean> {
        if (purchase.identityGroupId) return true;
        const linked = await this.linkedOrders(
            webhook,
            purchase.externalCustomerId,
            context
        );
        const groups = new Set(
            linked.flatMap((order) =>
                order.identityGroupId ? [order.identityGroupId] : []
            )
        );
        for (const group of groups) {
            if (await this.holdsPlan(webhook.merchantId, group, context)) {
                return true;
            }
        }
        return false;
    }

    private connection(
        webhook: MerchantWebhook,
        context: RunContext
    ): Promise<Connection> {
        return memoise(context.connections, webhook.id, async () =>
            this.connectionService.hasAuthError(webhook)
                ? "auth_error"
                : this.connectionService.resolveProvider(webhook)
        );
    }

    private async ask(
        purchase: PurchaseSelect,
        webhook: MerchantWebhook,
        context: RunContext
    ): Promise<
        ResolvedSubscriptionOrder | "retry" | "throttled" | "disconnected"
    > {
        const connected = await this.connection(webhook, context);
        if (!connected) return "disconnected";
        if (connected === "auth_error") {
            context.blocked.set(webhook.id, { kind: "unavailable" });
            return "retry";
        }
        try {
            return await connected.resolver.resolve(
                { externalId: purchase.externalId },
                connected.token
            );
        } catch (err) {
            return this.handleResolverError(err, purchase, webhook, context);
        }
    }

    private async handleResolverError(
        err: unknown,
        purchase: PurchaseSelect,
        webhook: MerchantWebhook,
        context: RunContext
    ): Promise<"retry" | "throttled"> {
        if (err instanceof SubscriptionRateLimitError) {
            log.warn(
                { webhookId: webhook.id, retryAfterMs: err.retryAfterMs },
                "Subscription provider throttled the token"
            );
            context.blocked.set(webhook.id, { kind: "throttled" });
            await this.deferThrottled(purchase, err.retryAfterMs, context);
            return "throttled";
        }
        if (err instanceof SubscriptionAuthError) {
            context.blocked.set(webhook.id, { kind: "unavailable" });
            await this.connectionService.recordAuthError(webhook);
        } else if (err instanceof SubscriptionUnavailableError) {
            context.blocked.set(webhook.id, { kind: "unavailable" });
            log.warn({ webhookId: webhook.id }, "Subscription provider down");
        } else {
            log.warn({ err, purchaseId: purchase.id }, "Resolver failed");
        }
        return "retry";
    }

    /** Pushes the throttled order and the webhook's other batch orders back without counting an attempt. */
    private async deferThrottled(
        purchase: PurchaseSelect,
        retryAfterMs: number,
        context: RunContext
    ): Promise<void> {
        const nextAttemptAt = new Date(
            context.now.getTime() + Math.max(retryAfterMs, BACKOFF_BASE_MS)
        ).toISOString();
        const others = context.remaining.get(purchase.webhookId) ?? [];
        context.remaining.set(purchase.webhookId, []);
        for (const order of [purchase, ...others]) {
            if (!order.subscription) continue;
            await this.purchaseRepository.updateSubscription(order.id, {
                ...order.subscription,
                nextAttemptAt,
            });
        }
    }

    private async retryOrGiveUp(
        purchase: PurchaseSelect,
        webhook: MerchantWebhook,
        pending: PurchaseSubscription,
        now: Date
    ): Promise<"retry" | "unresolved"> {
        const attempts = pending.attempts + 1;
        const age = now.getTime() - (purchase.createdAt ?? now).getTime();
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

    private async markUnresolved(
        purchase: PurchaseSelect,
        attempts: number
    ): Promise<void> {
        await this.purchaseRepository.updateSubscription(purchase.id, {
            state: "unresolved",
            attempts,
            nextAttemptAt: null,
        });
    }

    private async giveUp(
        purchase: PurchaseSelect,
        webhook: MerchantWebhook,
        pending: PurchaseSubscription
    ): Promise<void> {
        await this.markUnresolved(purchase, pending.attempts);
        await this.dropSubscription(purchase, webhook.merchantId);
    }

    private async apply(
        purchase: PurchaseSelect,
        webhook: MerchantWebhook,
        resolved: PurchaseSubscription,
        context: RunContext
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
                        resolved,
                        context
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
        resolved: PurchaseSubscription,
        context: RunContext
    ): Promise<void> {
        const identityGroupId =
            purchase.identityGroupId ??
            (await this.findSubscriberIdentity(
                purchase,
                webhook,
                resolved,
                context
            ));
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
        resolved: PurchaseSubscription,
        context: RunContext
    ): Promise<string | null> {
        const linked = (
            await this.linkedOrders(
                webhook,
                purchase.externalCustomerId,
                context
            )
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
