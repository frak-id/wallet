import { Spinner } from "@frak-labs/ui/component/Spinner";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { PwaInstall } from "@/module/common/component/PwaInstall";
import { TopLoader } from "@/module/common/component/TopLoader";
import { RootProvider } from "@/module/common/provider/RootProvider";
import { DetectPWA } from "@/module/wallet/component/DetectPWA";
// Import open panel to ensure it's initialized
import "@frak-labs/wallet-shared";
// Import global styles
import "@/styles/all.css";
import "nprogress/nprogress.css";

export const Route = createRootRoute({
    component: RootComponent,
    errorComponent: ErrorComponent,
    notFoundComponent: NotFoundComponent,
    pendingComponent: PendingComponent,
});

/**
 * Root component
 *
 * This component wraps the entire application with providers and global components.
 */
function RootComponent() {
    return (
        <RootProvider>
            <PwaInstall />
            <Outlet />
            <TopLoader />
            <DetectPWA />
            {import.meta.env.DEV && (
                <TanStackRouterDevtools position="bottom-right" />
            )}
        </RootProvider>
    );
}

/**
 * Pending component for route transitions
 */
function PendingComponent() {
    return (
        <div
            style={{
                position: "fixed",
                left: "50%",
                top: "50%",
                margin: "-8px 0 0 -8px",
                color: "black",
            }}
        >
            <Spinner />
        </div>
    );
}

/**
 * Error boundary component
 *
 * Handles errors that occur during route rendering.
 */
function ErrorComponent({ error }: { error: Error }) {
    if (error instanceof Error) {
        return (
            <div>
                <h1>Error</h1>
                <p>{error.message}</p>
                <p>The stack trace is:</p>
                <pre>{error.stack}</pre>
            </div>
        );
    }

    return <h1>Unknown Error</h1>;
}

/**
 * Not found component
 *
 * Displayed when a route is not found.
 */
function NotFoundComponent() {
    return (
        <div>
            <h1>404 - Page Not Found</h1>
            <p>The page you're looking for doesn't exist.</p>
        </div>
    );
}
