import type {
    RechargeClient,
    RechargeLookup,
    RechargeOrder,
} from "../../../infrastructure/integrations/recharge";
import {
    type ResolvedSubscriptionOrder,
    SubscriptionAuthError,
    SubscriptionRateLimitError,
    type SubscriptionResolver,
    SubscriptionUnavailableError,
    type TokenCheck,
} from "./types";

const SUBSCRIPTION_LINE = "subscription";

/** Credential, throttling and availability failures stop the resolution; the job decides what to retry. */
function assertUsable<T>(
    lookup: RechargeLookup<T>
): asserts lookup is Exclude<
    RechargeLookup<T>,
    { kind: "unauthorized" | "rate_limited" | "unavailable" }
> {
    if (lookup.kind === "unauthorized") throw new SubscriptionAuthError();
    if (lookup.kind === "rate_limited") {
        throw new SubscriptionRateLimitError(lookup.retryAfterMs);
    }
    if (lookup.kind === "unavailable") throw new SubscriptionUnavailableError();
}

function toAmount(value: string | undefined): number {
    const amount = Number(value);
    return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function subscriptionIds(order: RechargeOrder): string[] {
    const ids = (order.line_items ?? [])
        .filter(
            (line) =>
                line.purchase_item_type?.toLowerCase() === SUBSCRIPTION_LINE
        )
        .map((line) => String(line.purchase_item_id));
    return [...new Set(ids)];
}

/** Charge interval over order interval: how many cycles one prepaid charge pays for. */
function prepaidRatio(subscription: {
    order_interval_frequency?: number | string;
    charge_interval_frequency?: number | string;
}): number {
    const order = Number(subscription.order_interval_frequency);
    const charge = Number(subscription.charge_interval_frequency);
    // TODO(spike): confirm the prepaid ratio is charge_interval_frequency / order_interval_frequency
    if (!(order > 0 && charge > 0)) return 1;
    return Math.max(1, Math.round(charge / order));
}

export class RechargeSubscriptionResolver implements SubscriptionResolver {
    readonly provider = "recharge" as const;

    constructor(private readonly client: RechargeClient) {}

    verifyToken(token: string): Promise<TokenCheck> {
        return this.client.checkToken(token);
    }

    async resolve(
        order: { externalId: string },
        token: string
    ): Promise<ResolvedSubscriptionOrder | "retry"> {
        // TODO(spike): confirm GET /orders?external_order_id= finds the Shopify order, and how long after the webhook
        const lookup = await this.client.findOrderByExternalId(
            order.externalId,
            token
        );
        assertUsable(lookup);
        if (lookup.kind !== "found") return "retry";

        const providerSubscriptionIds = subscriptionIds(lookup.value);
        if (providerSubscriptionIds.length === 0) {
            return {
                kind: "none",
                providerSubscriptionIds,
                cyclesCovered: 0,
                merchandiseAmount: 0,
            };
        }

        // TODO(spike): confirm which Recharge field is the product subtotal after discounts (subtotal_price assumed)
        const merchandiseAmount = toAmount(lookup.value.subtotal_price);
        const recurring = lookup.value.type?.toLowerCase() === "recurring";
        const prepaid = lookup.value.is_prepaid === true;

        // TODO(spike): confirm the exact prepaid-shipment test (a recurring prepaid order with nothing to pay)
        if (recurring && prepaid && merchandiseAmount === 0) {
            return {
                kind: "prepaid_shipment",
                providerSubscriptionIds,
                cyclesCovered: 0,
                merchandiseAmount,
            };
        }

        const cyclesCovered = prepaid
            ? await this.prepaidCycles(providerSubscriptionIds[0], token)
            : 1;
        if (cyclesCovered === "retry") return "retry";

        return {
            kind: recurring ? "renewal" : "checkout",
            providerSubscriptionIds,
            cyclesCovered,
            merchandiseAmount,
        };
    }

    private async prepaidCycles(
        subscriptionId: string | undefined,
        token: string
    ): Promise<number | "retry"> {
        if (!subscriptionId) return 1;
        const lookup = await this.client.getSubscription(subscriptionId, token);
        assertUsable(lookup);
        return lookup.kind === "found" ? prepaidRatio(lookup.value) : 1;
    }
}
