import { createFileRoute } from "@tanstack/react-router";
import { isDemoMode } from "@/config/auth";
import { queryClient } from "@/module/common/provider/RootProvider";
import { MerchantTeam } from "@/module/merchant/component/Team";
import { merchantQueryOptions } from "@/module/merchant/queries/queryOptions";

export const Route = createFileRoute(
    "/_restricted/m/$merchantId/merchant/team"
)({
    loader: ({ params }) => {
        const demoMode = isDemoMode();
        queryClient.prefetchQuery(
            merchantQueryOptions(params.merchantId, demoMode)
        );
    },
    component: MerchantTeamPage,
});

function MerchantTeamPage() {
    const { merchantId } = Route.useParams();
    return <MerchantTeam merchantId={merchantId} />;
}
