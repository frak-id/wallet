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
import {
    PwaInstall,
    PwaInstallScript,
} from "@/module/common/component/PwaInstall";
import { TopLoader } from "@/module/common/component/TopLoader";
import { RootProvider } from "@/module/common/provider/RootProvider";
import { ReactScanWrapper } from "@/module/root/component/ReactScanWrapper";
import { rootConfig } from "@/module/root/config";
import { DetectPWA } from "@/module/wallet/component/DetectPWA";
import type { Route } from "./+types/root";
// Import open panel to ensure it's initialized
import "@frak-labs/wallet-shared";

export const meta = rootConfig.meta;
export const links = rootConfig.links;
export const handle = { i18n: ["translation"] };

/**
 * Fallback component for hydration
 *
 * @returns {JSX.Element} - The fallback component
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
 *
 * This component is responsible for handling errors in the application.
 * It wraps around child components and logs errors based on the error type.
 *
 * @param {Route.ErrorBoundaryProps} error - The error object.
 * @returns {JSX.Element} - The ErrorBoundary component.
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
 *
 * This component is responsible for rendering the application's layout.
 *
 * @param {ReactNode} children - The child components to render within the layout.
 * @returns {JSX.Element} - The rendered layout.
 */
export function Layout({ children }: { children: ReactNode }) {
    return (
        <html lang={"en"}>
            <head>
                <ReactScanWrapper />
                <meta charSet="utf-8" />
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1"
                />
                <Meta />
                <Links />
                <PwaInstallScript />
            </head>
            <body className="scrollbars">
                {children}
                <ScrollRestoration />
                <Scripts />
            </body>
        </html>
    );
}

/**
 * App component
 *
 * This component is the entry point of the application.
 *
 * @returns {JSX.Element} - The rendered application.
 */
export default function App() {
    return (
        <>
            <RootProvider>
                <PwaInstall />
                <Outlet />
            </RootProvider>
            <TopLoader />
            <DetectPWA />
        </>
    );
}
