import type { Hex } from "viem";
import { ProductDetails } from "@/module/product/component/ProductDetails";

export default async function ProductDetailPage(props: {
    params: Promise<{ productId: Hex }>;
}) {
    const params = await props.params;

    const { productId } = params;

    return <ProductDetails productId={productId} />;
}
