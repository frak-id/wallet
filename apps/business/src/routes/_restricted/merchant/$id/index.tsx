import { createFileRoute } from "@tanstack/react-router";
import { isDemoMode } from "@/context/auth/authEnv";
import { RouteError } from "@/module/common/component/RouteError";
import { queryClient } from "@/module/common/provider/RootProvider";
import { MerchantDetails } from "@/module/merchant/component/MerchantDetails";
import { merchantQueryOptions } from "@/module/merchant/queries/queryOptions";

export const Route = createFileRoute("/_restricted/merchant/$id/")({
    loader: ({ params }) => {
        const demoMode = isDemoMode();
        return queryClient.ensureQueryData(
            merchantQueryOptions(params.id, demoMode)
        );
    },
    component: MerchantPage,
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

function MerchantPage() {
    const { id } = Route.useParams();

    return <MerchantDetails merchantId={id} />;
}
