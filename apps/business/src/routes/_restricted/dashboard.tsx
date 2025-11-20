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
        return queryClient.ensureQueryData(
            myProductsQueryOptions(isDemoMode())
        );
    },
    component: Dashboard,
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
