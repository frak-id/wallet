import { createFileRoute } from "@tanstack/react-router";
import type { Hex } from "viem";
import { isDemoMode } from "@/context/auth/authEnv";
import { queryClient } from "@/module/common/provider/RootProvider";
import { Team } from "@/module/product/component/Team";
import { productMetadataQueryOptions } from "@/module/product/queries/queryOptions";

export const Route = createFileRoute("/_restricted/product/$id/team")({
    loader: ({ params }) => {
        return queryClient.ensureQueryData(
            productMetadataQueryOptions(params.id as Hex, isDemoMode())
        );
    },
    component: ProductTeamPage,
});

function ProductTeamPage() {
    const { id } = Route.useParams();

    return <Team productId={id as Hex} />;
}
