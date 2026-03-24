import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";

const INSTALL_CONTEXT_KEY = "frak_install_context";

type InstallSearch = {
    m?: string;
    a?: string;
};

export const Route = createFileRoute("/install")({
    validateSearch: (search: Record<string, unknown>): InstallSearch => ({
        m: typeof search.m === "string" ? search.m : undefined,
        a: typeof search.a === "string" ? search.a : undefined,
    }),
    component: InstallPage,
});

function InstallPage() {
    const { m: merchantId, a: anonymousId } = Route.useSearch();

    const contextStored = useMemo(() => {
        const context = {
            merchantId: merchantId ?? "test-merchant-123",
            anonymousId: anonymousId ?? "anon-abc-456",
            timestamp: Date.now(),
        };
        try {
            localStorage.setItem(INSTALL_CONTEXT_KEY, JSON.stringify(context));
            return context;
        } catch {
            return null;
        }
    }, [merchantId, anonymousId]);

    const playStoreUrl = useMemo(() => {
        if (!contextStored) return "";
        const referrerData = `merchantId=${contextStored.merchantId}&anonymousId=${contextStored.anonymousId}`;
        return `https://play.google.com/store/apps/details?id=id.frak.wallet&referrer=${encodeURIComponent(referrerData)}`;
    }, [contextStored]);

    const appStoreUrl = "https://apps.apple.com/app/frak-wallet/id6740261164";

    return (
        <div
            style={{
                padding: "24px",
                maxWidth: "480px",
                margin: "0 auto",
                fontFamily: "system-ui",
            }}
        >
            <h1>Install Frak Wallet</h1>
            <p>Get the app to track your rewards and earn from referrals.</p>

            {contextStored && (
                <div
                    style={{
                        background: "#f0f9ff",
                        padding: "12px",
                        borderRadius: "8px",
                        marginBottom: "16px",
                        fontSize: "14px",
                    }}
                >
                    <strong>Context saved to localStorage:</strong>
                    <pre
                        style={{
                            margin: "8px 0 0",
                            fontSize: "12px",
                            overflow: "auto",
                        }}
                    >
                        {JSON.stringify(contextStored, null, 2)}
                    </pre>
                </div>
            )}

            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    marginTop: "24px",
                }}
            >
                <a
                    href={appStoreUrl}
                    style={{
                        display: "block",
                        padding: "16px",
                        background: "#000",
                        color: "#fff",
                        borderRadius: "12px",
                        textDecoration: "none",
                        textAlign: "center",
                        fontWeight: 600,
                    }}
                >
                    Download on the App Store
                </a>
                <a
                    href={playStoreUrl}
                    style={{
                        display: "block",
                        padding: "16px",
                        background: "#01875f",
                        color: "#fff",
                        borderRadius: "12px",
                        textDecoration: "none",
                        textAlign: "center",
                        fontWeight: 600,
                    }}
                >
                    Get it on Google Play
                </a>
            </div>

            <div
                style={{
                    marginTop: "24px",
                    fontSize: "12px",
                    color: "#666",
                    wordBreak: "break-all",
                }}
            >
                <p>Play Store referrer URL:</p>
                <code style={{ fontSize: "11px" }}>{playStoreUrl}</code>
            </div>
        </div>
    );
}
