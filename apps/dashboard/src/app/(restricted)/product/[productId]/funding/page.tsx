import { ProductFunding } from "@/module/product/component/Funding";
import type { Hex } from "viem";

export default async function ProductFundingPage(props: {
    params: Promise<{ productId: Hex }>;
}) {
    const params = await props.params;

    const { productId } = params;

    return <ProductFunding productId={productId} />;
}
