import { Panel } from "@/module/common/component/Panel";
import { ButtonAddProduct } from "@/module/dashboard/component/ButtonAddProduct";
import { ProductItem } from "@/module/dashboard/component/ProductItem";
import { useMyProducts } from "@/module/dashboard/hooks/useMyProducts";
import { Spinner } from "@frak-labs/ui/component/Spinner";
import type { Hex } from "viem";
import styles from "./index.module.css";

/**
 * Component to display all the current user product
 * @constructor
 */
export function MyProducts() {
    const { products, isPending } = useMyProducts();

    if (isPending) {
        return <Spinner />;
    }

    return (
        <Panel variant={"ghost"} title={"My Products"} withBadge={false}>
            <ProductListSection
                products={[
                    ...(products?.operator ?? []),
                    ...(products?.owner ?? []),
                ]}
            />
        </Panel>
    );
}

function ProductListSection({
    products,
}: { products: { id: Hex; name: string; domain: string }[] }) {
    return (
        <div className={styles.contentListSection}>
            {products.map((content) => (
                <ProductListItem key={content.id} product={content} />
            ))}
            <ButtonAddProduct />
        </div>
    );
}

function ProductListItem({
    product,
}: { product: { id: Hex; name: string; domain: string } }) {
    const { id, name, domain } = product;
    return <ProductItem id={id} name={name} domain={domain} />;
}
