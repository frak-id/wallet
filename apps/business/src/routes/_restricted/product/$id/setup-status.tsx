import { Spinner } from "@frak-labs/ui/component/Spinner";
import { createFileRoute } from "@tanstack/react-router";
import type { Hex } from "viem";
import { queryClient } from "@/module/common/provider/RootProvider";
import { ProductSetupStatus } from "@/module/product/component/SetupStatus";
import { productMetadataQueryOptions } from "@/module/product/queries/queryOptions";
import { useAuthStore } from "@/stores/authStore";

export const Route = createFileRoute("/_restricted/product/$id/setup-status")({
    loader: ({ params }) => {
        const isDemoMode = useAuthStore.getState().isDemoMode;
        return queryClient.ensureQueryData(
            productMetadataQueryOptions(params.id as Hex, isDemoMode)
        );
    },
    component: ProductSetupStatusPage,
    pendingComponent: () => <Spinner />,
});

function ProductSetupStatusPage() {
    const { id } = Route.useParams();

    return <ProductSetupStatus productId={id as Hex} />;
}
