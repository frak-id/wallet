import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { useEffect } from "react";
import "../app.css";
import { RootProvider } from "../module/common/provider/RootProvider";

export const Route = createRootRoute({
    component: RootComponent,
    notFoundComponent: () => <div>404 - Page Not Found</div>,
});

function RootComponent() {
    // Set document title
    useEffect(() => {
        document.title = "Frak Dashboard Admin";
    }, []);

    return (
        <RootProvider>
            <Outlet />
            {import.meta.env.DEV && (
                <TanStackRouterDevtools position="bottom-right" />
            )}
        </RootProvider>
    );
}
