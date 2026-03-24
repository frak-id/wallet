import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

const INSTALL_CONTEXT_KEY = "frak_install_context";

export const Route = createFileRoute("/connect")({
    component: ConnectPage,
});

function ConnectPage() {
    const [status, setStatus] = useState("Reading localStorage...");

    useEffect(() => {
        try {
            const stored = localStorage.getItem(INSTALL_CONTEXT_KEY);

            if (!stored) {
                setStatus("No install context found in localStorage");
                window.location.href = "frakwallet://merge?error=no-data";
                return;
            }

            const context = JSON.parse(stored) as {
                merchantId?: string;
                anonymousId?: string;
            };
            const { merchantId, anonymousId } = context;

            if (!merchantId || !anonymousId) {
                setStatus("Invalid install context data");
                window.location.href = "frakwallet://merge?error=invalid-data";
                return;
            }

            setStatus(
                `Found: merchantId=${merchantId}, anonymousId=${anonymousId}. Redirecting...`
            );

            const params = new URLSearchParams({ merchantId, anonymousId });
            window.location.href = `frakwallet://merge?${params.toString()}`;
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Unknown error";
            setStatus(`Error: ${msg}`);
            window.location.href = "frakwallet://merge?error=read-failed";
        }
    }, []);

    return (
        <div
            style={{
                padding: "24px",
                textAlign: "center",
                fontFamily: "system-ui",
            }}
        >
            <p>{status}</p>
            <p style={{ fontSize: "12px", color: "#666" }}>
                This page should redirect automatically.
            </p>
        </div>
    );
}
