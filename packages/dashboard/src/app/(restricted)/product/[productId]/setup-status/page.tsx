import { ProductSetupStatus } from "@/module/product/component/SetupStatus";
import type { Hex } from "viem";

export default async function ProductSetupPage(props: {
    params: Promise<{ productId: Hex }>;
}) {
    const params = await props.params;

    const { productId } = params;

    return <ProductSetupStatus productId={productId} />;
}
