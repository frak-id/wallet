import type { Hex } from "viem";
import { Panel } from "@/module/common/component/Panel";
import { Row } from "@/module/common/component/Row";
import { FormLayout } from "@/module/forms/Form";
import { ProductHead } from "@/module/product/component/ProductHead";
import { useProductMetadata } from "@/module/product/hook/useProductMetadata";
import { productTypesLabel } from "@/module/product/utils/productTypes";
import styles from "./index.module.css";

export function ProductDetails({ productId }: { productId: Hex }) {
    const {
        data: product,
        isLoading: productIsLoading,
        isPending: productIsPending,
    } = useProductMetadata({ productId });

    if (productIsLoading || productIsPending) {
        return (
            <FormLayout>
                <ProductHead productId={productId} />
                <Panel title={"Loading product details..."}>
                    <p>Loading...</p>
                </Panel>
            </FormLayout>
        );
    }

    if (!product) {
        return (
            <FormLayout>
                <ProductHead productId={productId} />
                <Panel title={"Product not found"}>
                    <p>No product found with ID: {productId}</p>
                </Panel>
            </FormLayout>
        );
    }

    return (
        <FormLayout>
            <ProductHead productId={productId} />
            <Panel title={"Product Details"}>
                <div className={styles.productDetails}>
                    <div className={styles.productDetails__field}>
                        <div className={styles.productDetails__label}>
                            Product Name
                        </div>
                        <div className={styles.productDetails__value}>
                            {product.name}
                        </div>
                    </div>

                    <div className={styles.productDetails__field}>
                        <div className={styles.productDetails__label}>
                            Domain
                        </div>
                        <div className={styles.productDetails__value}>
                            {product.domain}
                        </div>
                    </div>

                    <div className={styles.productDetails__field}>
                        <div className={styles.productDetails__label}>
                            Product Types
                        </div>
                        <div className={styles.productDetails__value}>
                            <Row align={"start"}>
                                {product.productTypes.map((type) => (
                                    <span
                                        key={type}
                                        className={styles.productDetails__badge}
                                        title={
                                            productTypesLabel[type].description
                                        }
                                    >
                                        {productTypesLabel[type].name}
                                    </span>
                                ))}
                            </Row>
                        </div>
                    </div>
                </div>
            </Panel>

            <Panel title={"Webhook Interaction"} variant={"secondary"}>
                <p className={styles.productDetails__placeholder}>
                    Webhook interaction setup will be available soon.
                </p>
            </Panel>

            <Panel title={"Purchase Tracker"} variant={"secondary"}>
                <p className={styles.productDetails__placeholder}>
                    Purchase tracker setup will be available soon.
                </p>
            </Panel>

            <Panel title={"Interaction Settings"} variant={"secondary"}>
                <p className={styles.productDetails__placeholder}>
                    Interaction settings will be available soon.
                </p>
            </Panel>
        </FormLayout>
    );
}
