import type { PurchaseSubscription } from "../domain/purchases";
import type { InteractionSubscription } from "../domain/rewards/types";

/**
 * The block a purchase interaction carries for its order's resolution state.
 * `none` and `unresolved` orders carry nothing: they proceed as plain purchases.
 */
export function toInteractionSubscription(
    subscription: PurchaseSubscription | null | undefined
): InteractionSubscription | undefined {
    if (!subscription) return undefined;
    if (subscription.state === "pending") return { state: "pending" };
    if (subscription.state !== "resolved") return undefined;

    const merchandiseAmount = subscription.merchandiseAmount ?? 0;
    const providerSubscriptionIds = subscription.providerSubscriptionIds ?? [];
    switch (subscription.kind) {
        case "checkout":
        case "renewal":
            return {
                state: "resolved",
                kind: subscription.kind,
                cyclesCovered: subscription.cyclesCovered ?? 1,
                merchandiseAmount,
                counted: merchandiseAmount > 0,
                providerSubscriptionIds,
            };
        case "prepaid_shipment":
            return {
                state: "resolved",
                kind: "renewal",
                cyclesCovered: 0,
                merchandiseAmount: 0,
                counted: false,
                providerSubscriptionIds,
            };
        default:
            return undefined;
    }
}
