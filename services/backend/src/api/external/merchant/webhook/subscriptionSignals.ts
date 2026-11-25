import type { PurchaseSubscription } from "../../../../domain/purchases";
import type { ShopifyOrderUpdateWebhookDto } from "../../../../domain/purchases/dto/ShopifyWebhook";

type Order = Pick<
    ShopifyOrderUpdateWebhookDto,
    "line_items" | "note_attributes" | "source_name"
>;

// TODO(spike): confirm the renewal signals on a Recharge renewal order (source_name, rc_* note attributes)
const RENEWAL_SOURCE_NAMES = new Set(["subscription_contract"]);
const PROVIDER_NOTE_PREFIX = "rc_";

/** A line sold through a selling plan: the order may be a subscription checkout. */
export function hasSellingPlan(order: Pick<Order, "line_items">): boolean {
    // TODO(spike): confirm where a selling plan shows on the order webhook (selling_plan_id vs selling_plan_allocation)
    return order.line_items.some(
        (line) =>
            line.selling_plan_id != null || line.selling_plan_allocation != null
    );
}

/**
 * Strong signal only: a false positive would stop a real purchase from being
 * attributed, so provider note attributes alone never qualify.
 */
export function hasRenewalSignal(order: Pick<Order, "source_name">): boolean {
    return (
        order.source_name != null && RENEWAL_SOURCE_NAMES.has(order.source_name)
    );
}

/** Weak signal: enough to ask the provider, not enough to skip attribution. */
export function hasProviderNote(
    order: Pick<Order, "note_attributes">
): boolean {
    return (order.note_attributes ?? []).some((attribute) =>
        attribute.name.startsWith(PROVIDER_NOTE_PREFIX)
    );
}

/**
 * Marks an order the provider must classify before it can be rewarded: sold
 * through a selling plan, carrying a renewal signal or a provider note, or
 * placed by a customer who already has a subscription order. Merchants
 * without a provider are untouched.
 */
export async function pendingSubscription(params: {
    provider: string | null;
    order: Order;
    renewalSignal: boolean;
    hasKnownSubscriber: () => Promise<boolean>;
}): Promise<PurchaseSubscription | undefined> {
    const { provider, order, renewalSignal } = params;
    if (!provider) return undefined;

    const candidate =
        renewalSignal ||
        hasSellingPlan(order) ||
        hasProviderNote(order) ||
        (await params.hasKnownSubscriber());
    return candidate
        ? { state: "pending", attempts: 0, nextAttemptAt: null }
        : undefined;
}
