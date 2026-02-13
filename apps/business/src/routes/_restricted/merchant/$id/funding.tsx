import { createFileRoute } from "@tanstack/react-router";
import { isDemoMode } from "@/config/auth";
import { queryClient } from "@/module/common/provider/RootProvider";
import { MerchantFunding } from "@/module/merchant/component/Funding";
import { merchantQueryOptions } from "@/module/merchant/queries/queryOptions";

export const Route = createFileRoute("/_restricted/merchant/$id/funding")({
    loader: ({ params }) => {
        const demoMode = isDemoMode();
        queryClient.prefetchQuery(merchantQueryOptions(params.id, demoMode));
    },
    component: MerchantFundingPage,
});

function MerchantFundingPage() {
    const { id } = Route.useParams();

    return <MerchantFunding merchantId={id} />;
}
