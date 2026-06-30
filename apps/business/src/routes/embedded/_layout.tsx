import { useWalletStatus } from "@frak-labs/react-sdk";
import {
    createFileRoute,
    Outlet,
    useLocation,
    useNavigate,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { requireEmbeddedAuth } from "@/middleware/embeddedAuth";
import { EmbeddedShell } from "@/module/embedded/component/EmbeddedShell";
import { useAuthStore } from "@/stores/authStore";

const sdkInitTimeout = 3000;

export const Route = createFileRoute("/embedded/_layout")({
    beforeLoad: requireEmbeddedAuth,
    component: EmbeddedLayout,
});

function EmbeddedLayout() {
    const { data: walletStatus, isPending } = useWalletStatus();
    const clearAuth = useAuthStore((s) => s.clearAuth);
    const navigate = useNavigate();
    const location = useLocation();
    const [sdkTimedOut, setSdkTimedOut] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setSdkTimedOut(true), sdkInitTimeout);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        const walletConnected = walletStatus?.wallet;
        const shouldRedirect =
            walletConnected === undefined && (sdkTimedOut || !isPending);

        if (!shouldRedirect) return;

        clearAuth();
        navigate({
            to: "/embedded/auth",
            search: { redirect: location.href },
        });
    }, [
        walletStatus,
        isPending,
        sdkTimedOut,
        clearAuth,
        navigate,
        location.href,
    ]);

    return (
        <EmbeddedShell>
            <Outlet />
        </EmbeddedShell>
    );
}
