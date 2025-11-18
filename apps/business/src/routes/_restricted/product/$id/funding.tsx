import { Spinner } from "@frak-labs/ui/component/Spinner";
import { createFileRoute } from "@tanstack/react-router";
import type { Hex } from "viem";
import { queryClient } from "@/module/common/provider/RootProvider";
import { ProductFunding } from "@/module/product/component/Funding";
import { productMetadataQueryOptions } from "@/module/product/queries/queryOptions";
import { demoModeStore } from "@/stores/demoModeStore";

export const Route = createFileRoute("/_restricted/product/$id/funding")({
    loader: ({ params }) => {
        const isDemoMode = demoModeStore.getState().isDemoMode;
        return queryClient.ensureQueryData(
            productMetadataQueryOptions(params.id as Hex, isDemoMode)
        );
    },
    component: ProductFundingPage,
    pendingComponent: () => <Spinner />,
});

function ProductFundingPage() {
    const { id } = Route.useParams();

    return <ProductFunding productId={id as Hex} />;
}
