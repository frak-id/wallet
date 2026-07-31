import type { ProductDetails, SharingPageProduct } from "@frak-labs/core-sdk";

/**
 * Which products drive the reward a sharing page advertises: the selected one
 * when there is a selection, otherwise the whole list. Returns `undefined`
 * (not `[]`) when there is nothing to select from, so the caller falls back to
 * the unscoped ranking.
 *
 * Shared by both sharing pages (listener iframe + wallet route) so they cannot
 * advertise different rewards for the same selection.
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
