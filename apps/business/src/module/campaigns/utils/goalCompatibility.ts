import {
    type InteractionTypesKey,
    interactionTypes,
    type ProductTypesKey,
} from "@frak-labs/core-sdk";
import { interactionTypesInfo } from "@/module/product/utils/interactionTypes";
import type { Goal } from "@/types/Campaign";

/**
 * Mapping from product types to their available interaction types
 * Derived from the interactionTypes constant in @frak-labs/core-sdk
 */
const productTypeToInteractions: Record<
    ProductTypesKey,
    InteractionTypesKey[]
> = Object.entries(interactionTypes).reduce(
    (acc, [productType, interactions]) => {
        acc[productType as ProductTypesKey] = Object.keys(
            interactions
        ) as InteractionTypesKey[];
        return acc;
    },
    {} as Record<ProductTypesKey, InteractionTypesKey[]>
);

/**
 * Get the product types that support a given goal
 * @param goal - The goal to check
 * @returns Array of product types that support this goal
 */
export function getProductTypesForGoal(goal: Goal): ProductTypesKey[] {
    const supportingProductTypes: Set<ProductTypesKey> = new Set();

    // For each product type, check if any of its interactions support this goal
    for (const [productType, interactions] of Object.entries(
        productTypeToInteractions
    )) {
        for (const interaction of interactions) {
            const info = interactionTypesInfo[interaction];
            if (info?.relatedGoal === goal && !info.hidden) {
                supportingProductTypes.add(productType as ProductTypesKey);
                break; // Found one, no need to check more interactions for this product type
            }
        }
    }

    return Array.from(supportingProductTypes);
}

/**
 * Check if a goal is compatible with the given product types
 * @param goal - The goal to check
 * @param productTypes - The product types to check against
 * @returns true if at least one product type supports the goal
 */
export function isGoalCompatible(
    goal: Goal,
    productTypes: ProductTypesKey[]
): boolean {
    const supportingProductTypes = getProductTypesForGoal(goal);
    return productTypes.some((pt) => supportingProductTypes.includes(pt));
}

/**
 * Get a human-readable label for a product type
 * @param productType - The product type key
 * @returns Human-readable label
 */
export function getProductTypeLabel(productType: ProductTypesKey): string {
    const labels: Record<ProductTypesKey, string> = {
        press: "Press",
        webshop: "Webshop",
        referral: "Referral",
        purchase: "Purchase",
        retail: "Retail",
        dapp: "DApp",
    };
    return labels[productType] ?? productType;
}

/**
 * Get a human-readable label for a goal
 * @param goal - The goal
 * @returns Human-readable label
 */
export function getGoalLabel(goal: Goal): string {
    const labels: Record<Goal, string> = {
        traffic: "Traffic",
        registration: "Registration",
        sales: "Sales",
        awareness: "Awareness",
        retention: "Retention",
    };
    return labels[goal] ?? goal;
}
