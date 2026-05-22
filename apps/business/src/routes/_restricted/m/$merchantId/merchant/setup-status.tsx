import { createFileRoute } from "@tanstack/react-router";
import { isDemoMode } from "@/config/auth";
import { queryClient } from "@/module/common/provider/RootProvider";
import { MerchantSetupStatus } from "@/module/merchant/component/SetupStatus";
import { merchantQueryOptions } from "@/module/merchant/queries/queryOptions";

export const Route = createFileRoute(
    "/_restricted/m/$merchantId/merchant/setup-status"
)({
    loader: ({ params }) => {
        const demoMode = isDemoMode();
        queryClient.prefetchQuery(
            merchantQueryOptions(params.merchantId, demoMode)
        );
    },
    component: MerchantSetupStatusPage,
});

function MerchantSetupStatusPage() {
    const { merchantId } = Route.useParams();
    return <MerchantSetupStatus merchantId={merchantId} />;
}
