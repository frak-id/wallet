import { Spinner } from "@frak-labs/ui/component/Spinner";
import { createFileRoute } from "@tanstack/react-router";
import type { Hex } from "viem";
import { queryClient } from "@/module/common/provider/RootProvider";
import { ProductDetails } from "@/module/product/component/ProductDetails";
import { productMetadataQueryOptions } from "@/module/product/queries/queryOptions";
import { demoModeStore } from "@/stores/demoModeStore";

export const Route = createFileRoute("/_restricted/product/$id/")({
    loader: ({ params }) => {
        const isDemoMode = demoModeStore.getState().isDemoMode;
        return queryClient.ensureQueryData(
            productMetadataQueryOptions(params.id as Hex, isDemoMode)
        );
    },
    component: ProductPage,
    pendingComponent: () => <Spinner />,
});

function ProductPage() {
    const { id } = Route.useParams();

    return <ProductDetails productId={id as Hex} />;
}
