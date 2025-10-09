import { isRouteErrorResponse } from "react-router";
import type { Route } from "./+types/root.sso-popup";
import { SsoPopupView } from "./views/auth/sso-popup";

export default function SsoPopupRoot() {
    return <SsoPopupView />;
}

/**
 * ErrorBoundary for SSO popup route
 * Catches and displays any errors that occur during popup initialization or redirect
 */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
    if (isRouteErrorResponse(error)) {
        return (
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100vh",
                    margin: 0,
                    background: "#f5f5f5",
                    fontFamily: "sans-serif",
                    color: "#d32f2f",
                    textAlign: "center",
                    padding: "1rem",
                }}
            >
                <div>
                    <h1>
                        {error.status} {error.statusText}
                    </h1>
                    <p>{error.data}</p>
                </div>
            </div>
        );
    }

    if (error instanceof Error) {
        return (
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100vh",
                    margin: 0,
                    background: "#f5f5f5",
                    fontFamily: "sans-serif",
                    color: "#d32f2f",
                    textAlign: "center",
                    padding: "1rem",
                }}
            >
                <div>
                    <h1>Error</h1>
                    <p>{error.message}</p>
                </div>
            </div>
        );
    }

    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100vh",
                margin: 0,
                background: "#f5f5f5",
                fontFamily: "sans-serif",
                color: "#d32f2f",
            }}
        >
            <h1>Unknown Error</h1>
        </div>
    );
}
