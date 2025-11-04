import { createFileRoute } from "@tanstack/react-router";
import type { Hex } from "viem";
import { requireAuth } from "@/middleware/auth";
import { RestrictedLayout } from "@/module/common/component/RestrictedLayout";
import { ProductDetails } from "@/module/product/component/ProductDetails";

export const Route = createFileRoute("/product/$id/")({
    beforeLoad: requireAuth,
    component: ProductPage,
});

function ProductPage() {
    const { id } = Route.useParams();

    return (
        <RestrictedLayout>
            <ProductDetails productId={id as Hex} />
        </RestrictedLayout>
    );
}
