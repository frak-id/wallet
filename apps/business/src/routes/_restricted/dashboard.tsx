import { Spinner } from "@frak-labs/ui/component/Spinner";
import { createFileRoute } from "@tanstack/react-router";
import { isDemoMode } from "@/context/auth/authEnv";
import { Breadcrumb } from "@/module/common/component/Breadcrumb";
import { Head } from "@/module/common/component/Head";
import { CriticalError } from "@/module/common/component/RouteError";
import { queryClient } from "@/module/common/provider/RootProvider";
import { MyProducts } from "@/module/dashboard/component/Products";
import { myProductsQueryOptions } from "@/module/dashboard/queries/queryOptions";

export const Route = createFileRoute("/_restricted/dashboard")({
    loader: () => {
        // Use isomorphic function - works on both server and client
        const isDemo = isDemoMode();
        return queryClient.ensureQueryData(myProductsQueryOptions(isDemo));
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
