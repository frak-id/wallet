import { createFileRoute } from "@tanstack/react-router";
import { isDemoMode } from "@/config/auth";
import { MerchantNotFoundError } from "@/module/common/component/RouteError";
import { queryClient } from "@/module/common/provider/RootProvider";
import { ExplorerPage } from "@/module/merchant/component/Explorer";
import { merchantQueryOptions } from "@/module/merchant/queries/queryOptions";

export const Route = createFileRoute(
    "/_restricted/m/$merchantId/merchant/explorer"
)({
    staticData: { shell: "bare" },
    loader: ({ params }) => {
        const demoMode = isDemoMode();
        queryClient.prefetchQuery(
            merchantQueryOptions(params.merchantId, demoMode)
        );
    },
    component: MerchantExplorerPage,
    errorComponent: MerchantNotFoundError,
});

function MerchantExplorerPage() {
    const { merchantId } = Route.useParams();
    return <ExplorerPage merchantId={merchantId} />;
}
