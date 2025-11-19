import { Spinner } from "@frak-labs/ui/component/Spinner";
import { createFileRoute } from "@tanstack/react-router";
import type { Hex } from "viem";
import { isDemoMode } from "@/context/auth/authEnv";
import { queryClient } from "@/module/common/provider/RootProvider";
import { ProductSetupStatus } from "@/module/product/component/SetupStatus";
import { productMetadataQueryOptions } from "@/module/product/queries/queryOptions";

export const Route = createFileRoute("/_restricted/product/$id/setup-status")({
    loader: ({ params }) => {
        return queryClient.ensureQueryData(
            productMetadataQueryOptions(params.id as Hex, isDemoMode())
        );
    },
    component: ProductSetupStatusPage,
    pendingComponent: () => <Spinner />,
});

function ProductSetupStatusPage() {
    const { id } = Route.useParams();

    return <ProductSetupStatus productId={id as Hex} />;
}
