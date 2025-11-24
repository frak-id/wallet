import { Button } from "@frak-labs/ui/component/Button";
import { useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import type { Hex } from "viem";
import { Panel } from "@/module/common/component/Panel";
import { ProductItem } from "@/module/dashboard/component/ProductItem";
import { useMyProducts } from "@/module/dashboard/hooks/useMyProducts";
import styles from "./index.module.css";

/**
 * Component to display all the current user product
 * @constructor
 */
export function MyProducts() {
    const { products } = useMyProducts();

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
}: {
    products: { id: Hex; name: string; domain: string }[];
}) {
    const navigate = useNavigate();
    return (
        <div className={styles.contentListSection}>
            {products.map((content) => (
                <ProductListItem key={content.id} product={content} />
            ))}

            <Button
                size={"none"}
                variant={"ghost"}
                onClick={() => {
                    navigate({ to: "/mint" });
                }}
            >
                <ProductItem
                    name={
                        <>
                            <Plus />
                            List a Product
                        </>
                    }
                    domain={"domain.com"}
                    showActions={false}
                    isLink={false}
                />
            </Button>
        </div>
    );
}

function ProductListItem({
    product,
}: {
    product: { id: Hex; name: string; domain: string };
}) {
    const { id, name, domain } = product;
    return <ProductItem id={id} name={name} domain={domain} />;
}
