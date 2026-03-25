import { isRunningInProd } from "@frak-labs/app-essentials";
import { authenticatedBackendApi } from "@frak-labs/wallet-shared/common/api/backendClient";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/connect")({
    beforeLoad: () => {
        if (isRunningInProd) {
            throw redirect({ to: "/" });
        }
    },
    component: ConnectPage,
});

function ConnectPage() {
    const {
        data: context,
        error,
    } = useQuery({
        queryKey: ["install-context-retrieval"],
        queryFn: async () => {
            const { data, error } =
                await authenticatedBackendApi.common.mobile[
                    "install-context"
                ].retrieve.get();
            if (error) throw error;
            return data;
        },
        gcTime: 0,
        meta: { storable: false },
    });

    const handleContinue = () => {
        if (!context) return;
        const params = new URLSearchParams({
            merchantId: context.merchantId ?? "nop",
            anonymousId: context.anonymousId ?? "nop",
        });
        window.location.href = `frakwallet://merge?${params.toString()}`;
    };

    if (!context && !error) {
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
                <p style={{ color: "#563e3e" }}>
                    Error: {JSON.stringify(error)}
                </p>
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
