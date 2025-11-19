import { Spinner } from "@frak-labs/ui/component/Spinner";
import { createFileRoute } from "@tanstack/react-router";
import type { Hex } from "viem";
import { RouteError } from "@/module/common/component/RouteError";
import { queryClient } from "@/module/common/provider/RootProvider";
import { ProductDetails } from "@/module/product/component/ProductDetails";
import { productMetadataQueryOptions } from "@/module/product/queries/queryOptions";
import { useAuthStore } from "@/stores/authStore";

export const Route = createFileRoute("/_restricted/product/$id/")({
    loader: ({ params }) => {
        const isDemoMode = useAuthStore.getState().isDemoMode;
        return queryClient.ensureQueryData(
            productMetadataQueryOptions(params.id as Hex, isDemoMode)
        );
    },
    component: ProductPage,
    pendingComponent: () => <Spinner />,
    errorComponent: (props) => (
        <RouteError
            {...props}
            title="Product Not Found"
            message="The product you're looking for doesn't exist or you don't have access to it."
            fallbackPath="/dashboard"
            fallbackLabel="Back to Dashboard"
            showRetry={false}
        />
    ),
});

function ProductPage() {
    const { id } = Route.useParams();

    return <ProductDetails productId={id as Hex} />;
}
