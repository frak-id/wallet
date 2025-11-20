import { createFileRoute } from "@tanstack/react-router";
import type { Hex } from "viem";
import { isDemoMode } from "@/context/auth/authEnv";
import { queryClient } from "@/module/common/provider/RootProvider";
import { ProductFunding } from "@/module/product/component/Funding";
import { productMetadataQueryOptions } from "@/module/product/queries/queryOptions";

export const Route = createFileRoute("/_restricted/product/$id/funding")({
    loader: ({ params }) => {
        return queryClient.ensureQueryData(
            productMetadataQueryOptions(params.id as Hex, isDemoMode())
        );
    },
    component: ProductFundingPage,
});

function ProductFundingPage() {
    const { id } = Route.useParams();

    return <ProductFunding productId={id as Hex} />;
}
