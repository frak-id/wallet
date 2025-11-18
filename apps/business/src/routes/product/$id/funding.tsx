import { Spinner } from "@frak-labs/ui/component/Spinner";
import { createFileRoute } from "@tanstack/react-router";
import type { Hex } from "viem";
import { requireAuth } from "@/middleware/auth";
import { RestrictedLayout } from "@/module/common/component/RestrictedLayout";
import { queryClient } from "@/module/common/provider/RootProvider";
import { ProductFunding } from "@/module/product/component/Funding";
import { productMetadataQueryOptions } from "@/module/product/queries/queryOptions";
import { demoModeStore } from "@/stores/demoModeStore";

export const Route = createFileRoute("/product/$id/funding")({
    beforeLoad: requireAuth,
    loader: ({ params }) => {
        const isDemoMode = demoModeStore.getState().isDemoMode;
        return queryClient.ensureQueryData(
            productMetadataQueryOptions(params.id as Hex, isDemoMode)
        );
    },
    component: ProductFundingPage,
    pendingComponent: () => (
        <RestrictedLayout>
            <Spinner />
        </RestrictedLayout>
    ),
});

function ProductFundingPage() {
    const { id } = Route.useParams();

    return (
        <RestrictedLayout>
            <ProductFunding productId={id as Hex} />
        </RestrictedLayout>
    );
}
