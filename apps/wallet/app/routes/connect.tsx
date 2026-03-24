import { authenticatedBackendApi } from "@frak-labs/wallet-shared/common/api/backendClient";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

type RetrievedContext = {
    merchantId: string;
    anonymousId: string;
};

export const Route = createFileRoute("/connect")({
    component: ConnectPage,
});

function ConnectPage() {
    const [context, setContext] = useState<RetrievedContext | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        authenticatedBackendApi.common.mobile["install-context"].retrieve
            .get()
            .then(({ data, error }) => {
                if (error) throw error;
                if (data && "error" in data) {
                    setError(data.error);
                } else if (data) {
                    setContext(data);
                }
                setLoading(false);
            })
            .catch((e) => {
                setError(e instanceof Error ? e.message : String(e));
                setLoading(false);
            });
    }, []);

    const handleContinue = () => {
        if (!context) return;
        const params = new URLSearchParams({
            merchantId: context.merchantId,
            anonymousId: context.anonymousId,
        });
        window.location.href = `frakwallet://merge?${params.toString()}`;
    };

    if (loading) {
        return (
            <div
                style={{
                    padding: "24px",
                    maxWidth: "480px",
                    margin: "0 auto",
                    fontFamily: "system-ui",
                    textAlign: "center",
                }}
            >
                <p>Retrieving install context...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div
                style={{
                    padding: "24px",
                    maxWidth: "480px",
                    margin: "0 auto",
                    fontFamily: "system-ui",
                    textAlign: "center",
                }}
            >
                <h2>No Install Context</h2>
                <p style={{ color: "#c62828" }}>Error: {error}</p>
            </div>
        );
    }

    return (
        <div
            style={{
                padding: "24px",
                maxWidth: "480px",
                margin: "0 auto",
                fontFamily: "system-ui",
            }}
        >
            <h2>Install Context Retrieved</h2>
            <div
                style={{
                    padding: "16px",
                    background: "#e8f5e9",
                    borderRadius: "8px",
                    marginBottom: "24px",
                }}
            >
                <pre
                    style={{
                        margin: 0,
                        fontSize: "13px",
                        whiteSpace: "pre-wrap",
                    }}
                >
                    {JSON.stringify(context, null, 2)}
                </pre>
            </div>
            <button
                type="button"
                onClick={handleContinue}
                style={{
                    width: "100%",
                    padding: "16px",
                    background: "#000",
                    color: "#fff",
                    border: "none",
                    borderRadius: "12px",
                    fontSize: "16px",
                    fontWeight: 600,
                    cursor: "pointer",
                }}
            >
                Continue to App
            </button>
        </div>
    );
}
