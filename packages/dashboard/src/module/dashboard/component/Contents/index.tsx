import { Panel } from "@/module/common/component/Panel";
import { ButtonAddProduct } from "@/module/dashboard/component/ButtonAddProduct";
import { ProductItem } from "@/module/dashboard/component/ProductItem";
import { useMyContents } from "@/module/dashboard/hooks/useMyContents";
import { Spinner } from "@module/component/Spinner";
import { useRouter } from "next/navigation";
import styles from "./index.module.css";

/**
 * Component to display all the current user content
 * @constructor
 */
export function MyContents() {
    const { isEmpty, contents, isPending } = useMyContents();

    if (isPending) {
        return <Spinner />;
    }

    if (isEmpty || !contents) {
        return <NoContents />;
    }

    return (
        <Panel variant={"ghost"} title={"My Products"}>
            <ProductListSection
                products={[
                    ...(contents?.operator ?? []),
                    ...(contents?.owner ?? []),
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
    const router = useRouter();
    return (
        <ProductItem
            onClick={() => {
                router.push(`/product/${product.id}`);
            }}
        >
            {product.name}
            <br />
            {product.domain}
        </ProductItem>
    );
}
