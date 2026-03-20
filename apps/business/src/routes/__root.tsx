import { TanStackDevtools } from "@tanstack/react-devtools";
import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { RootProvider } from "@/module/common/provider/RootProvider";
import "@/polyfill/bigint-serialization";
import "@/styles/all.css";
import "nprogress/nprogress.css";
import styles from "./__root.module.css";

export const Route = createRootRoute({
    component: RootComponent,
    errorComponent: ErrorComponent,
    notFoundComponent: NotFound,
});

function ErrorComponent({ error }: { error: Error }) {
    return (
        <div className={styles.errorContainer}>
            <h1 className={styles.errorContainer__title}>
                Something went wrong
            </h1>
            <p className={styles.errorContainer__message}>{error.message}</p>
            {import.meta.env.DEV && (
                <pre className={styles.errorContainer__stack}>
                    {error.stack}
                </pre>
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
        <div className={styles.errorContainer}>
            <h1 className={styles.notFound__title}>404</h1>
            <h2 className={styles.notFound__subtitle}>Page Not Found</h2>
            <p className={styles.notFound__message}>
                The page you're looking for doesn't exist or has been moved.
            </p>
            <Link to="/dashboard" className={styles.notFound__link}>
                Go to Dashboard
            </Link>
        </div>
    );
}
