import type { Hex } from "viem";
import { Team } from "@/module/product/component/Team";

export default async function ProductTeamPage(props: {
    params: Promise<{ productId: Hex }>;
}) {
    const params = await props.params;

    const { productId } = params;

    return <Team productId={productId} />;
}
