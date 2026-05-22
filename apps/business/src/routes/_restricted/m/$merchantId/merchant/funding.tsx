import { createFileRoute } from "@tanstack/react-router";
import { isDemoMode } from "@/config/auth";
import { queryClient } from "@/module/common/provider/RootProvider";
import { MerchantFunding } from "@/module/merchant/component/Funding";
import { merchantQueryOptions } from "@/module/merchant/queries/queryOptions";

export const Route = createFileRoute(
    "/_restricted/m/$merchantId/merchant/funding"
)({
    loader: ({ params }) => {
        const demoMode = isDemoMode();
        queryClient.prefetchQuery(
            merchantQueryOptions(params.merchantId, demoMode)
        );
    },
    component: MerchantFundingPage,
});

function MerchantFundingPage() {
    const { merchantId } = Route.useParams();
    return <MerchantFunding merchantId={merchantId} />;
}
