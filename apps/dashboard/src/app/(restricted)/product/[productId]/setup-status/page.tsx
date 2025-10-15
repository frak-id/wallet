import type { Hex } from "viem";
import { ProductSetupStatus } from "@/module/product/component/SetupStatus";

export default async function ProductSetupPage(props: {
    params: Promise<{ productId: Hex }>;
}) {
    const params = await props.params;

    const { productId } = params;

    return <ProductSetupStatus productId={productId} />;
}
