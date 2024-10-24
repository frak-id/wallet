import { ProductSetupStatus } from "@/module/product/component/SetupStatus";
import type { Hex } from "viem";

export default function ProductSetupPage({
    params: { productId },
}: {
    params: { productId: Hex };
}) {
    return <ProductSetupStatus productId={productId} />;
}
