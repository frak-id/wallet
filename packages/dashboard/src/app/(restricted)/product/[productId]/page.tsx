import { Head } from "@/module/common/component/Head";
import { ProductDetails } from "@/module/product/component/ProductDetails";
import { useMemo } from "react";

export default function ProductDetailPage({
    params,
}: {
    params: { productId: string };
}) {
    const pId = useMemo(() => BigInt(params.productId), [params.productId]);

    return (
        <>
            <Head title={{ content: "Product details" }} />
            <ProductDetails productId={pId} />
        </>
    );
}
