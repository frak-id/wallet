import { isRunningInProd } from "@frak-labs/app-essentials";
import { authenticatedBackendApi } from "@frak-labs/wallet-shared/common/api/backendClient";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo } from "react";

type InstallSearch = {
    m?: string;
    a?: string;
};

export const Route = createFileRoute("/install")({
    beforeLoad: () => {
        if (isRunningInProd) {
            throw redirect({ to: "/" });
        }
    },
    validateSearch: (search: Record<string, unknown>): InstallSearch => ({
        m: typeof search.m === "string" ? search.m : undefined,
        a: typeof search.a === "string" ? search.a : undefined,
    }),
    component: InstallPage,
});

function InstallPage() {
    const { m: merchantId, a: anonymousId } = Route.useSearch();

    const mId = merchantId ?? "test-merchant-123";
    const aId = anonymousId ?? "anon-abc-456";

    const {
        error,
        isFetched: isSaved,
        data,
    } = useQuery({
        queryKey: ["install-context", mId, aId],
        queryFn: async () => {
            const { data, error } = await authenticatedBackendApi.common.mobile[
                "install-context"
            ].store.post({ merchantId: mId, anonymousId: aId });
            if (error) throw error;
            return data;
        },
        gcTime: 0,
        meta: { storable: false },
    });

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

            {error && (
                <div
                    style={{
                        padding: "12px",
                        borderRadius: "8px",
                        marginBottom: "16px",
                        fontSize: "14px",
                        background: "#ffebee",
                        color: "#c62828",
                    }}
                >
                    Failed to save context: {JSON.stringify(error)}
                </div>
            )}

            {isSaved && (
                <div
                    style={{
                        padding: "12px",
                        borderRadius: "8px",
                        marginBottom: "16px",
                        fontSize: "14px",
                    }}
                >
                    <strong>Context saved</strong>
                    <p style={{ margin: "4px 0 0", fontSize: "12px" }}>
                        Install the app — your referral data will be picked up
                        automatically.
                    </p>
                    <p>{JSON.stringify(data)}</p>
                </div>
            )}

            {!isSaved && !error && (
                <p style={{ fontSize: "14px", color: "#666" }}>
                    Saving context...
                </p>
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
