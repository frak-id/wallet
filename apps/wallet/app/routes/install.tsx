import { isRunningInProd } from "@frak-labs/app-essentials";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo } from "react";

type InstallSearch = {
    m?: string;
    a?: string;
    saved?: string;
};

const backendUrl = process.env.BACKEND_URL ?? "https://backend.gcp-dev.frak.id";
const walletUrl = process.env.FRAK_WALLET_URL ?? "https://wallet-dev.frak.id";

export const Route = createFileRoute("/install")({
    beforeLoad: () => {
        if (isRunningInProd) {
            throw redirect({ to: "/" });
        }
    },
    validateSearch: (search: Record<string, unknown>): InstallSearch => ({
        m: typeof search.m === "string" ? search.m : undefined,
        a: typeof search.a === "string" ? search.a : undefined,
        saved: typeof search.saved === "string" ? search.saved : undefined,
    }),
    component: InstallPage,
});

function InstallPage() {
    const { m: merchantId, a: anonymousId, saved } = Route.useSearch();

    const mId = merchantId ?? "test-merchant-123";
    const aId = anonymousId ?? "anon-abc-456";
    const isSaved = saved === "1";

    const handleSaveContext = () => {
        const redirectBack = `${walletUrl}/install?m=${encodeURIComponent(mId)}&a=${encodeURIComponent(aId)}&saved=1`;
        const storeUrl = new URL(
            "/common/mobile/install-context/store-redirect",
            backendUrl
        );
        storeUrl.searchParams.set("merchantId", mId);
        storeUrl.searchParams.set("anonymousId", aId);
        storeUrl.searchParams.set("redirect", redirectBack);
        window.location.href = storeUrl.toString();
    };

    const playStoreUrl = useMemo(() => {
        const referrerData = `merchantId=${mId}&anonymousId=${aId}`;
        return `https://play.google.com/store/apps/details?id=id.frak.wallet&referrer=${encodeURIComponent(referrerData)}`;
    }, [mId, aId]);

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

            {isSaved ? (
                <div
                    style={{
                        padding: "12px",
                        borderRadius: "8px",
                        marginBottom: "16px",
                        fontSize: "14px",
                        background: "#e8f5e9",
                    }}
                >
                    <strong>Context saved</strong>
                    <p style={{ margin: "4px 0 0", fontSize: "12px" }}>
                        Install the app — your referral data will be picked up
                        automatically.
                    </p>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={handleSaveContext}
                    style={{
                        width: "100%",
                        padding: "16px",
                        background: "#1976d2",
                        color: "#fff",
                        border: "none",
                        borderRadius: "12px",
                        fontSize: "16px",
                        fontWeight: 600,
                        cursor: "pointer",
                        marginBottom: "16px",
                    }}
                >
                    Save Install Context
                </button>
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
        </div>
    );
}
