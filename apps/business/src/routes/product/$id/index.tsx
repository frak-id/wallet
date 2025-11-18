import { Spinner } from "@frak-labs/ui/component/Spinner";
import { createFileRoute } from "@tanstack/react-router";
import type { Hex } from "viem";
import { requireAuth } from "@/middleware/auth";
import { RestrictedLayout } from "@/module/common/component/RestrictedLayout";
import { queryClient } from "@/module/common/provider/RootProvider";
import { ProductDetails } from "@/module/product/component/ProductDetails";
import { productMetadataQueryOptions } from "@/module/product/queries/queryOptions";
import { demoModeStore } from "@/stores/demoModeStore";

export const Route = createFileRoute("/product/$id/")({
    beforeLoad: requireAuth,
    loader: ({ params }) => {
        const isDemoMode = demoModeStore.getState().isDemoMode;
        return queryClient.ensureQueryData(
            productMetadataQueryOptions(params.id as Hex, isDemoMode)
        );
    },
    component: ProductPage,
    pendingComponent: () => (
        <RestrictedLayout>
            <Spinner />
        </RestrictedLayout>
    ),
});

function ProductPage() {
    const { id } = Route.useParams();

    return (
        <RestrictedLayout>
            <ProductDetails productId={id as Hex} />
        </RestrictedLayout>
    );
}
