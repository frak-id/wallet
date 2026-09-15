import type { SharingPageProduct } from "@frak-labs/core-sdk";
import {
    RadioGroup,
    RadioGroupItem,
} from "@frak-labs/design-system/components/RadioGroup";
import { Text } from "@frak-labs/design-system/components/Text";
import { useId } from "react";
import * as styles from "./sharingPage.css";
import {
    renderableProducts,
    type SharingProducts,
    type SharingT,
} from "./types";

/** The product picker. Rendered only when the caller passed products. */
export function ProductList({
    products,
    t,
}: {
    products: SharingProducts;
    t: SharingT;
}) {
    return (
        <RadioGroup
            className={styles.productList}
            // The cards stack, so Up/Down are the axis that matters; without
            // this Radix handles Left/Right only. `loop` wraps at both ends.
            orientation="vertical"
            loop
            // Radix round-trips the value verbatim: it emits an item's own
            // `value` prop, so this is always a `String(index)` we set below,
            // indexing `items` rather than the rendered subset.
            value={String(products.selectedIndex)}
            onValueChange={(value) => products.onSelect(Number(value))}
            aria-label={t("sdk.sharingPage.products.label")}
        >
            {renderableProducts(products).map(({ product, index }) => (
                <ProductCard
                    // Products carry no stable id, and the list is a fixed
                    // per-request payload that is never reordered in place.
                    key={`${product.title}-${index}`}
                    product={product}
                    index={index}
                    selected={products.selectedIndex === index}
                />
            ))}
        </RadioGroup>
    );
}

function ProductCard({
    product,
    index,
    selected,
}: {
    product: SharingPageProduct;
    index: number;
    selected: boolean;
}) {
    const id = useId();
    return (
        // The label is a sibling of the radio, never its wrapper: Radix commits
        // an arrow move by clicking the focused radio, and a wrapping label
        // re-dispatches that click to its control, so the two cancel out and
        // the selection lags the focus by one.
        <div
            className={
                selected ? styles.productCardSelected : styles.productCard
            }
        >
            <RadioGroupItem id={id} value={String(index)} />
            {product.imageUrl && (
                // Decorative: the label already names the product.
                <img
                    src={product.imageUrl}
                    alt=""
                    className={styles.productImage}
                />
            )}
            <label htmlFor={id} className={styles.productCardLabel}>
                <Text as="span" variant="bodySmall" weight="medium">
                    {product.title}
                </Text>
            </label>
        </div>
    );
}
