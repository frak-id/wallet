import { Panel } from "@/module/common/component/Panel";
import { ButtonAddProduct } from "@/module/dashboard/component/ButtonAddProduct";
import { ProductItem } from "@/module/dashboard/component/ProductItem";
import { useMyProducts } from "@/module/dashboard/hooks/useMyProducts";
import { Spinner } from "@module/component/Spinner";
import Link from "next/link";
import styles from "./index.module.css";

/**
 * Component to display all the current user product
 * @constructor
 */
export function MyProducts() {
    const { isEmpty, products, isPending } = useMyProducts();

    if (isPending) {
        return <Spinner />;
    }

    if (isEmpty || !products) {
        return <NoContents />;
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

function NoContents() {
    return (
        <div>
            You don't have any content yet.
            <ButtonAddProduct />
        </div>
    );
}

function ProductListSection({
    products,
}: { products: { id: bigint; name: string; domain: string }[] }) {
    return (
        <div className={styles.contentListSection}>
            <ButtonAddProduct />
            {products.map((content) => (
                <ProductListItem key={content.id} product={content} />
            ))}
        </div>
    );
}

function ProductListItem({
    product,
}: { product: { id: bigint; name: string; domain: string } }) {
    return (
        <Link href={`/product/${product.id}`}>
            <ProductItem>
                {product.name}
                <br />
                {product.domain}
            </ProductItem>
        </Link>
    );
}
