import { createFileRoute } from "@tanstack/react-router";
import { isDemoMode } from "@/config/auth";
import { RouteError } from "@/module/common/component/RouteError";
import { queryClient } from "@/module/common/provider/RootProvider";
import { CustomizePage } from "@/module/merchant/component/Customize";
import { merchantQueryOptions } from "@/module/merchant/queries/queryOptions";

export const Route = createFileRoute("/_restricted/merchant/$id/customize")({
    loader: ({ params }) => {
        const demoMode = isDemoMode();
        queryClient.prefetchQuery(merchantQueryOptions(params.id, demoMode));
    },
    component: MerchantCustomizePage,
    errorComponent: (props) => (
        <RouteError
            {...props}
            title="Merchant Not Found"
            message="The merchant you're looking for doesn't exist or you don't have access to it."
            fallbackPath="/dashboard"
            fallbackLabel="Back to Dashboard"
            showRetry={false}
        />
    ),
});

function MerchantCustomizePage() {
    const { id } = Route.useParams();

    return <CustomizePage merchantId={id} />;
}
