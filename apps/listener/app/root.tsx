import { Spinner } from "@frak-labs/ui/component/Spinner";
import type { ReactNode } from "react";
import {
    isRouteErrorResponse,
    Links,
    Meta,
    Outlet,
    Scripts,
    ScrollRestoration,
} from "react-router";
import { RootProvider } from "@/module/providers/RootProvider";
import type { Route } from "./+types/root";

export const meta = () => {
    return [{ title: "Frak Listener" }];
};

/**
 * Fallback component for hydration
 */
export function HydrateFallback() {
    return (
        <>
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
            <Scripts />
        </>
    );
}

/**
 * ErrorBoundary component
 */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
    if (isRouteErrorResponse(error)) {
        return (
            <>
                <h1>
                    {error.status} {error.statusText}
                </h1>
                <p>{error.data}</p>
            </>
        );
    }

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
 * Layout component
 */
export function Layout({ children }: { children: ReactNode }) {
    return (
        <html lang={"en"}>
            <head>
                <meta charSet="utf-8" />
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1"
                />
                <Meta />
                <Links />
            </head>
            <body>
                {children}
                <ScrollRestoration />
                <Scripts />
            </body>
        </html>
    );
}

/**
 * App component
 */
export default function App() {
    return (
        <RootProvider>
            <Outlet />
        </RootProvider>
    );
}
