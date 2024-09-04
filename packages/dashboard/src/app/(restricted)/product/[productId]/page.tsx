import { ProductDetails } from "@/module/product/component/ProductDetails";
import { useMemo } from "react";
import { toHex } from "viem";

export default function ProductDetailPage({
    params,
}: {
    params: { productId: string };
}) {
    const pId = useMemo(
        () => toHex(BigInt(params.productId)),
        [params.productId]
    );

    return <ProductDetails productId={pId} />;
}
