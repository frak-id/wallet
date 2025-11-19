import { isRunningInProd } from "@frak-labs/app-essentials";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { Address } from "viem";
import { useAuthStore } from "@/stores/authStore";

export const Route = createFileRoute("/demo")({
    beforeLoad: () => {
        // Only allow in development and staging (block production)
        if (isRunningInProd) {
            throw new Error("Demo mode not available in production");
        }
    },
    component: DemoActivation,
});

function DemoActivation() {
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        async function activateDemo() {
            try {
                // Create a mock demo session with a fake wallet address
                const demoWallet =
                    "0x0000000000000000000000000000000000000001" as Address;
                const demoToken = "demo-token";
                const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 1 week

                // Set auth in store (includes demo mode)
                const store = useAuthStore.getState();
                store.setAuth(demoToken, demoWallet, expiresAt);

                await navigate({ to: "/dashboard" });
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : "Failed to activate demo mode"
                );
            }
        }

        activateDemo();
    }, [navigate]);

    if (error) {
        return (
            <div
                style={{
                    fontFamily: "system-ui, -apple-system, sans-serif",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "100vh",
                    margin: 0,
                    backgroundColor: "#0b1f3d",
                    color: "#fff",
                }}
            >
                <div style={{ textAlign: "center" }}>
                    <p style={{ color: "#ff4444" }}>{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div
            style={{
                fontFamily: "system-ui, -apple-system, sans-serif",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "100vh",
                margin: 0,
                backgroundColor: "#0b1f3d",
                backgroundImage:
                    'url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUxOSIgaGVpZ2h0PSIxMDg3IiB2aWV3Qm94PSIwIDAgMTUxOSAxMDg3IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cmVjdCB3aWR0aD0iMTUxOSIgaGVpZ2h0PSIxMDg3IiBmaWxsPSJ1cmwoI3BhaW50MF9yYWRpYWxfOTg2MF8yNjc0KSIvPgo8ZGVmcz4KPHJhZGlhbEdyYWRpZW50IGlkPSJwYWludDBfcmFkaWFsXzk4NjBfMjY3NCIgY3g9IjAiIGN5PSIwIiByPSIxIiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgZ3JhZGllbnRUcmFuc2Zvcm09InRyYW5zbGF0ZSgzOTAuMzQ4IDQ5Mi4xMjQpIHJvdGF0ZSgyMC4yODMxKSBzY2FsZSgxNDQ0LjMgNDI3LjYzNykiPgo8c3RvcCBzdG9wLWNvbG9yPSIjMTk0MzgwIi8+CjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzAzMTkzQSIvPgo8L3JhZGlhbEdyYWRpZW50Pgo8L2RlZnM+Cjwvc3ZnPgo=")',
                backgroundSize: "cover",
                backgroundAttachment: "fixed",
                color: "#fff",
            }}
        >
            <div style={{ textAlign: "center" }}>
                <div
                    style={{
                        border: "3px solid rgba(255, 255, 255, 0.1)",
                        borderTop: "3px solid #4169e1",
                        borderRadius: "50%",
                        width: "40px",
                        height: "40px",
                        animation: "spin 1s linear infinite",
                        margin: "20px auto",
                    }}
                />
                <p>Activating demo mode...</p>
            </div>
            <style>
                {`
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `}
            </style>
        </div>
    );
}
