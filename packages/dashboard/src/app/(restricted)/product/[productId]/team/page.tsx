import { Team } from "@/module/product/component/Team";
import type { Hex } from "viem";

export default function ProductTeamPage({
    params: { productId },
}: {
    params: { productId: Hex };
}) {
    return <Team productId={productId} />;
}
