import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import "../styles/theme.css";
import { MainLayout } from "../module/common/component/MainLayout";
import { Spinner } from "../module/common/component/Spinner";
import { RootProvider } from "../module/common/provider/RootProvider";

export const Route = createRootRoute({
    component: RootComponent,
    pendingComponent: () => (
        <div
            style={{
                position: "fixed",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
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
            <MainLayout>
                <Outlet />
            </MainLayout>
            {import.meta.env.DEV && (
                <TanStackRouterDevtools position="bottom-right" />
            )}
        </RootProvider>
    );
}
