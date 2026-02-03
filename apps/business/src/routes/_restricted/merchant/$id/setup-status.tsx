import { createFileRoute } from "@tanstack/react-router";
import { isDemoMode } from "@/config/auth";
import { queryClient } from "@/module/common/provider/RootProvider";
import { MerchantSetupStatus } from "@/module/merchant/component/SetupStatus";
import { merchantQueryOptions } from "@/module/merchant/queries/queryOptions";

export const Route = createFileRoute("/_restricted/merchant/$id/setup-status")({
    loader: ({ params }) => {
        const demoMode = isDemoMode();
        queryClient.prefetchQuery(merchantQueryOptions(params.id, demoMode));
    },
    component: MerchantSetupStatusPage,
});

function MerchantSetupStatusPage() {
    const { id } = Route.useParams();

    return <MerchantSetupStatus merchantId={id} />;
}
