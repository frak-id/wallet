import { Team } from "@/module/product/component/Team";
import type { Hex } from "viem";

export default async function ProductTeamPage(props: {
    params: Promise<{ productId: Hex }>;
}) {
    const params = await props.params;

    const { productId } = params;

    return <Team productId={productId} />;
}
