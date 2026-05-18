import { Text } from "@frak-labs/design-system/components/Text";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { RootProvider } from "@/module/common/provider/RootProvider";
import "@/polyfill/bigint-serialization";
import "@/styles/all";
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
            <Text as="h1" variant="display" className={errorContainerTitle}>
                Something went wrong
            </Text>
            <Text
                variant="body"
                color="tertiary"
                className={errorContainerMessage}
            >
                {error.message}
            </Text>
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
            <Text as="h1" variant="display1" className={notFoundTitle}>
                404
            </Text>
            <Text as="h2" variant="heading2" className={notFoundSubtitle}>
                Page Not Found
            </Text>
            <Text variant="body" color="tertiary" className={notFoundMessage}>
                The page you're looking for doesn't exist or has been moved.
            </Text>
            <Link to="/dashboard" className={notFoundLink}>
                Go to Dashboard
            </Link>
        </div>
    );
}
