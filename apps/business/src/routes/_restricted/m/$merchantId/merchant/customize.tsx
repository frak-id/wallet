import { createFileRoute } from "@tanstack/react-router";
import { isDemoMode } from "@/config/auth";
import { MerchantNotFoundError } from "@/module/common/component/RouteError";
import { queryClient } from "@/module/common/provider/RootProvider";
import { CustomizePage } from "@/module/merchant/component/Customize";
import { merchantQueryOptions } from "@/module/merchant/queries/queryOptions";

export const Route = createFileRoute(
    "/_restricted/m/$merchantId/merchant/customize"
)({
    staticData: { shell: "bare" },
    loader: ({ params }) => {
        const demoMode = isDemoMode();
        queryClient.prefetchQuery(
            merchantQueryOptions(params.merchantId, demoMode)
        );
    },
    component: MerchantCustomizePage,
    errorComponent: MerchantNotFoundError,
});

function MerchantCustomizePage() {
    const { merchantId } = Route.useParams();
    return <CustomizePage merchantId={merchantId} />;
}
