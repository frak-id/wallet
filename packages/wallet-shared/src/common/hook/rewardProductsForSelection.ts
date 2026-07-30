import type { ProductDetails, SharingPageProduct } from "@frak-labs/core-sdk";

/**
 * Which products should drive the reward a sharing page advertises.
 *
 * With a product selected, the reward card has to describe *that* product —
 * otherwise it can advertise a campaign that doesn't apply to what the user
 * is about to share. Without a selection, the best campaign across the whole
 * list is the right summary.
 *
 * Returns `undefined` (not `[]`) when there is nothing to select from, so the
 * caller reproduces the exact "no product context" ranking that shipped
 * before product-scoped campaigns existed.
 *
 * Shared by both sharing pages (listener iframe + wallet route) so the two
 * cannot drift into advertising different rewards for the same selection.
 */
export function rewardProductsForSelection(
    products: SharingPageProduct[] | undefined,
    selectedIndex: number | undefined
): ProductDetails[] | undefined {
    if (!products || products.length === 0) return undefined;
    const selected =
        selectedIndex === undefined ? undefined : products[selectedIndex];
    return selected ? [selected] : products;
}
