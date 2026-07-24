import type { ProductScopeTarget } from "@frak-labs/core-sdk/rewards";
import { useMemo } from "preact/hooks";

/**
 * Build a stable {@link ProductScopeTarget} from a component's flat
 * `product*` props, or `undefined` when none are set — so `useReward`'s
 * effect doesn't re-fire on every render from a fresh object literal, and
 * components that don't set any `product*` prop see the exact same
 * "no product context" behavior as before this feature existed.
 *
 * `productPrice` accepts a `string` because server-rendered surfaces
 * (Shopify Liquid, WordPress PHP) bind component props as HTML attributes,
 * which `preact-custom-element` always delivers as raw strings — same
 * reasoning as `PostPurchaseProps.products`. An unparseable price is dropped
 * rather than surfaced as `NaN`.
 */
export function useProductScopeTarget(
    productId: string | undefined,
    productSku: string | undefined,
    productPrice: number | string | undefined
): ProductScopeTarget | undefined {
    return useMemo(() => {
        if (
            productId === undefined &&
            productSku === undefined &&
            productPrice === undefined
        ) {
            return undefined;
        }
        const parsedPrice =
            typeof productPrice === "string"
                ? Number.parseFloat(productPrice)
                : productPrice;
        return {
            productId,
            sku: productSku,
            unitPrice:
                parsedPrice !== undefined && Number.isFinite(parsedPrice)
                    ? parsedPrice
                    : undefined,
        };
    }, [productId, productSku, productPrice]);
}
