import { Spinner } from "@frak-labs/ui/component/Spinner";
import { createFileRoute } from "@tanstack/react-router";
import type { Hex } from "viem";
import { requireAuth } from "@/middleware/auth";
import { RestrictedLayout } from "@/module/common/component/RestrictedLayout";
import { queryClient } from "@/module/common/provider/RootProvider";
import { Team } from "@/module/product/component/Team";
import { productMetadataQueryOptions } from "@/module/product/queries/queryOptions";
import { demoModeStore } from "@/stores/demoModeStore";

export const Route = createFileRoute("/product/$id/team")({
    beforeLoad: requireAuth,
    loader: ({ params }) => {
        const isDemoMode = demoModeStore.getState().isDemoMode;
        return queryClient.ensureQueryData(
            productMetadataQueryOptions(params.id as Hex, isDemoMode)
        );
    },
    component: ProductTeamPage,
    pendingComponent: () => (
        <RestrictedLayout>
            <Spinner />
        </RestrictedLayout>
    ),
});

function ProductTeamPage() {
    const { id } = Route.useParams();

    return (
        <RestrictedLayout>
            <Team productId={id as Hex} />
        </RestrictedLayout>
    );
}
