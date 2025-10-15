import type { Hex } from "viem";
import { ProductFunding } from "@/module/product/component/Funding";

export default async function ProductFundingPage(props: {
    params: Promise<{ productId: Hex }>;
}) {
    const params = await props.params;

    const { productId } = params;

    return <ProductFunding productId={productId} />;
}
