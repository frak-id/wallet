import { Spinner } from "@frak-labs/ui/component/Spinner";
import { createFileRoute } from "@tanstack/react-router";
import type { Hex } from "viem";
import { queryClient } from "@/module/common/provider/RootProvider";
import { Team } from "@/module/product/component/Team";
import { productMetadataQueryOptions } from "@/module/product/queries/queryOptions";
import { useAuthStore } from "@/stores/authStore";

export const Route = createFileRoute("/_restricted/product/$id/team")({
    loader: ({ params }) => {
        const isDemoMode = useAuthStore.getState().token === "demo-token";
        return queryClient.ensureQueryData(
            productMetadataQueryOptions(params.id as Hex, isDemoMode)
        );
    },
    component: ProductTeamPage,
    pendingComponent: () => <Spinner />,
});

function ProductTeamPage() {
    const { id } = Route.useParams();

    return <Team productId={id as Hex} />;
}
