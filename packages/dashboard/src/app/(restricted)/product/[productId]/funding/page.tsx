import { ProductFunding } from "@/module/product/component/Funding";
import type { Hex } from "viem";

export default function ProductFundingPage({
    params: { productId },
}: {
    params: { productId: Hex };
}) {
    return <ProductFunding productId={productId} />;
}
