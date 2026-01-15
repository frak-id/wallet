import { createFileRoute } from "@tanstack/react-router";
import { isDemoMode } from "@/context/auth/authEnv";
import { queryClient } from "@/module/common/provider/RootProvider";
import { MerchantTeam } from "@/module/merchant/component/Team";
import { merchantQueryOptions } from "@/module/merchant/queries/queryOptions";

export const Route = createFileRoute("/_restricted/merchant/$id/team")({
    loader: ({ params }) => {
        const demoMode = isDemoMode();
        return queryClient.ensureQueryData(
            merchantQueryOptions(params.id, demoMode)
        );
    },
    component: MerchantTeamPage,
});

function MerchantTeamPage() {
    const { id } = Route.useParams();

    return <MerchantTeam merchantId={id} />;
}
