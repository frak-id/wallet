import { Spinner } from "@frak-labs/ui/component/Spinner";
import { createFileRoute } from "@tanstack/react-router";
import { Breadcrumb } from "@/module/common/component/Breadcrumb";
import { Head } from "@/module/common/component/Head";
import { CriticalError } from "@/module/common/component/RouteError";
import { queryClient } from "@/module/common/provider/RootProvider";
import { MyProducts } from "@/module/dashboard/component/Products";
import { myProductsQueryOptions } from "@/module/dashboard/queries/queryOptions";
import { useAuthStore } from "@/stores/authStore";

export const Route = createFileRoute("/_restricted/dashboard")({
    loader: () => {
        const isDemoMode = useAuthStore.getState().isDemoMode;
        return queryClient.ensureQueryData(myProductsQueryOptions(isDemoMode));
    },
    component: Dashboard,
    pendingComponent: () => <Spinner />,
    errorComponent: CriticalError,
});

function Dashboard() {
    return (
        <>
            <Head
                title={{ content: "Dashboard" }}
                leftSection={<Breadcrumb current={"Home"} />}
            />
            <MyProducts />
        </>
    );
}
