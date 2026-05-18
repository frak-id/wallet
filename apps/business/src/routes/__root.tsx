import { TanStackDevtools } from "@tanstack/react-devtools";
import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { RootProvider } from "@/module/common/provider/RootProvider";
import "@/polyfill/bigint-serialization";
import "@frak-labs/design-system/theme";
import "@/styles/all.css";
import "nprogress/nprogress.css";
import {
    errorContainer,
    errorContainerMessage,
    errorContainerStack,
    errorContainerTitle,
    notFoundLink,
    notFoundMessage,
    notFoundSubtitle,
    notFoundTitle,
} from "./__root.css";

export const Route = createRootRoute({
    component: RootComponent,
    errorComponent: ErrorComponent,
    notFoundComponent: NotFound,
});

function ErrorComponent({ error }: { error: Error }) {
    return (
        <div className={errorContainer}>
            <h1 className={errorContainerTitle}>Something went wrong</h1>
            <p className={errorContainerMessage}>{error.message}</p>
            {import.meta.env.DEV && (
                <pre className={errorContainerStack}>{error.stack}</pre>
            )}
        </div>
    );
}

function RootComponent() {
    return (
        <RootProvider>
            <Outlet />
            {import.meta.env.DEV && (
                <TanStackDevtools
                    config={{
                        position: "bottom-right",
                    }}
                    plugins={[
                        {
                            name: "Tanstack Router",
                            render: <TanStackRouterDevtoolsPanel />,
                        },
                    ]}
                />
            )}
        </RootProvider>
    );
}

function NotFound() {
    return (
        <div className={errorContainer}>
            <h1 className={notFoundTitle}>404</h1>
            <h2 className={notFoundSubtitle}>Page Not Found</h2>
            <p className={notFoundMessage}>
                The page you're looking for doesn't exist or has been moved.
            </p>
            <Link to="/dashboard" className={notFoundLink}>
                Go to Dashboard
            </Link>
        </div>
    );
}
