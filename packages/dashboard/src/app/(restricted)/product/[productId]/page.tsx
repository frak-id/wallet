import { ProductDetails } from "@/module/product/component/ProductDetails";
import type { Hex } from "viem";

export default function ProductDetailPage({
    params: { productId },
}: {
    params: { productId: Hex };
}) {
    return <ProductDetails productId={productId} />;
}
