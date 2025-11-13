import { ReactScan } from "@frak-labs/ui/component/ReactScan";
import { Spinner } from "@frak-labs/ui/component/Spinner";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import "../styles/all.css";
import { MainLayout } from "../module/common/component/MainLayout";
import { RootProvider } from "../module/common/provider/RootProvider";

export const Route = createRootRoute({
    component: RootComponent,
    pendingComponent: () => (
        <div
            style={{
                position: "fixed",
                left: "50%",
                top: "50%",
                margin: "-8px 0 0 -8px",
            }}
        >
            <Spinner />
        </div>
    ),
    notFoundComponent: () => <div>404 - Page Not Found</div>,
});

function RootComponent() {
    return (
        <RootProvider>
            {process.env.DEBUG === "true" && <ReactScan />}
            <MainLayout>
                <Outlet />
            </MainLayout>
            {import.meta.env.DEV && (
                <TanStackRouterDevtools position="bottom-right" />
            )}
        </RootProvider>
    );
}
