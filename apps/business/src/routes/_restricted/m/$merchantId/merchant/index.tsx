import { createFileRoute } from "@tanstack/react-router";
import { isDemoMode } from "@/config/auth";
import { MerchantNotFoundError } from "@/module/common/component/RouteError";
import { queryClient } from "@/module/common/provider/RootProvider";
import { MerchantIntegration } from "@/module/merchant/component/Integration";
import { merchantQueryOptions } from "@/module/merchant/queries/queryOptions";

export const Route = createFileRoute("/_restricted/m/$merchantId/merchant/")({
    staticData: { shell: "bare" },
    loader: ({ params }) => {
        const demoMode = isDemoMode();
        queryClient.prefetchQuery(
            merchantQueryOptions(params.merchantId, demoMode)
        );
    },
    component: MerchantPage,
    errorComponent: MerchantNotFoundError,
});

function MerchantPage() {
    const { merchantId } = Route.useParams();
    return <MerchantIntegration merchantId={merchantId} />;
}
