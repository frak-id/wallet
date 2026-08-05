import type { SharingPageProduct } from "@frak-labs/core-sdk";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { CheckIcon } from "@frak-labs/design-system/icons";
import * as styles from "./sharingPage.css";
import type { SharingProducts } from "./types";

/** The product picker. Rendered only when the caller passed products. */
export function ProductList({ products }: { products: SharingProducts }) {
    return (
        <Stack as="section" space="s">
            {products.items.map((product, index) => (
                <ProductCard
                    // Products carry no stable id, and the list is a fixed
                    // per-request payload that is never reordered in place.
                    key={`${product.title}-${index}`}
                    product={product}
                    selected={products.selectedIndex === index}
                    onSelect={() => products.onSelect(index)}
                />
            ))}
        </Stack>
    );
}

function ProductCard({
    product,
    selected,
    onSelect,
}: {
    product: SharingPageProduct;
    selected: boolean;
    onSelect: () => void;
}) {
    return (
        <button type="button" className={styles.productCard} onClick={onSelect}>
            <span
                className={
                    selected ? styles.checkIcon : styles.checkIconUnselected
                }
            >
                {selected && <CheckIcon width={20} height={20} />}
            </span>
            {product.imageUrl && (
                <img
                    src={product.imageUrl}
                    alt={product.title}
                    className={styles.productImage}
                />
            )}
            <Text variant="bodySmall" weight="medium">
                {product.title}
            </Text>
        </button>
    );
}
