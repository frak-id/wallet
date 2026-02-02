import { TanStackDevtools } from "@tanstack/react-devtools";
import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { RootProvider } from "@/module/common/provider/RootProvider";
import "@/polyfill/bigint-serialization";
import "@/styles/all.css";
import "nprogress/nprogress.css";

export const Route = createRootRoute({
    component: RootComponent,
    errorComponent: ErrorComponent,
    notFoundComponent: NotFound,
});

function ErrorComponent({ error }: { error: Error }) {
    if (error instanceof Error) {
        return (
            <div
                style={{
                    padding: "2rem",
                    textAlign: "center",
                    maxWidth: "600px",
                    margin: "4rem auto",
                }}
            >
                <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>
                    Something went wrong
                </h1>
                <p style={{ color: "#94a3b8", marginBottom: "1rem" }}>
                    {error.message}
                </p>
                {import.meta.env.DEV && (
                    <pre
                        style={{
                            textAlign: "left",
                            overflow: "auto",
                            padding: "1rem",
                            background: "#1e293b",
                            borderRadius: "0.5rem",
                            fontSize: "0.75rem",
                        }}
                    >
                        {error.stack}
                    </pre>
                )}
            </div>
        );
    }

    return <h1>Unknown Error</h1>;
}

/**
 * Root component
 *
 * This component wraps the entire application with providers and global components.
 */
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
        <div
            style={{
                padding: "2rem",
                textAlign: "center",
                maxWidth: "600px",
                margin: "4rem auto",
            }}
        >
            <h1 style={{ fontSize: "3rem", marginBottom: "1rem" }}>404</h1>
            <h2 style={{ marginBottom: "1rem" }}>Page Not Found</h2>
            <p style={{ color: "#94a3b8", marginBottom: "2rem" }}>
                The page you're looking for doesn't exist or has been moved.
            </p>
            <Link
                to="/dashboard"
                style={{
                    display: "inline-block",
                    padding: "0.75rem 1.5rem",
                    backgroundColor: "#0891b2",
                    color: "#ffffff",
                    borderRadius: "0.5rem",
                    textDecoration: "none",
                    fontWeight: 600,
                }}
            >
                Go to Dashboard
            </Link>
        </div>
    );
}
