import { createFileRoute } from "@tanstack/react-router";
import { isDemoMode } from "@/context/auth/authEnv";
import { queryClient } from "@/module/common/provider/RootProvider";
import { MerchantSetupStatus } from "@/module/merchant/component/SetupStatus";
import { merchantQueryOptions } from "@/module/merchant/queries/queryOptions";

export const Route = createFileRoute("/_restricted/merchant/$id/setup-status")({
    loader: ({ params }) => {
        const demoMode = isDemoMode();
        return queryClient.ensureQueryData(
            merchantQueryOptions(params.id, demoMode)
        );
    },
    component: MerchantSetupStatusPage,
});

function MerchantSetupStatusPage() {
    const { id } = Route.useParams();

    return <MerchantSetupStatus merchantId={id} />;
}
