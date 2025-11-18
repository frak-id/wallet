import { Spinner } from "@frak-labs/ui/component/Spinner";
import { createFileRoute } from "@tanstack/react-router";
import type { Hex } from "viem";
import { requireAuth } from "@/middleware/auth";
import { RestrictedLayout } from "@/module/common/component/RestrictedLayout";
import { queryClient } from "@/module/common/provider/RootProvider";
import { ProductSetupStatus } from "@/module/product/component/SetupStatus";
import { productMetadataQueryOptions } from "@/module/product/queries/queryOptions";
import { demoModeStore } from "@/stores/demoModeStore";

export const Route = createFileRoute("/product/$id/setup-status")({
    beforeLoad: requireAuth,
    loader: ({ params }) => {
        const isDemoMode = demoModeStore.getState().isDemoMode;
        return queryClient.ensureQueryData(
            productMetadataQueryOptions(params.id as Hex, isDemoMode)
        );
    },
    component: ProductSetupStatusPage,
    pendingComponent: () => (
        <RestrictedLayout>
            <Spinner />
        </RestrictedLayout>
    ),
});

function ProductSetupStatusPage() {
    const { id } = Route.useParams();

    return (
        <RestrictedLayout>
            <ProductSetupStatus productId={id as Hex} />
        </RestrictedLayout>
    );
}
