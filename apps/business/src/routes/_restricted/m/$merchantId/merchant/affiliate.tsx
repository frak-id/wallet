import { createFileRoute } from "@tanstack/react-router";
import { isDemoMode } from "@/config/auth";
import { MerchantNotFoundError } from "@/module/common/component/RouteError";
import { queryClient } from "@/module/common/provider/RootProvider";
import { AffiliatePage } from "@/module/merchant/component/Affiliate";
import { merchantQueryOptions } from "@/module/merchant/queries/queryOptions";

export const Route = createFileRoute(
    "/_restricted/m/$merchantId/merchant/affiliate"
)({
    staticData: { shell: "bare" },
    loader: ({ params }) => {
        const demoMode = isDemoMode();
        queryClient.prefetchQuery(
            merchantQueryOptions(params.merchantId, demoMode)
        );
    },
    component: MerchantAffiliatePage,
    errorComponent: MerchantNotFoundError,
});

function MerchantAffiliatePage() {
    const { merchantId } = Route.useParams();
    return <AffiliatePage merchantId={merchantId} />;
}
