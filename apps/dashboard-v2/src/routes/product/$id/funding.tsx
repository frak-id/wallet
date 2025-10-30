import { createFileRoute } from "@tanstack/react-router";
import type { Hex } from "viem";
import { requireAuth } from "@/middleware/auth";
import { RestrictedLayout } from "@/module/common/component/RestrictedLayout";
import { ProductFunding } from "@/module/product/component/Funding";

export const Route = createFileRoute("/product/$id/funding")({
    beforeLoad: requireAuth,
    component: ProductFundingPage,
});

function ProductFundingPage() {
    const { id } = Route.useParams();

    return (
        <RestrictedLayout>
            <ProductFunding productId={id as Hex} />
        </RestrictedLayout>
    );
}
