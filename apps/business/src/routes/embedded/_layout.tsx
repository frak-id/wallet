import { useWalletStatus } from "@frak-labs/react-sdk";
import {
    createFileRoute,
    Outlet,
    useLocation,
    useNavigate,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { requireEmbeddedAuth } from "@/middleware/embeddedAuth";
import { useAuthStore } from "@/stores/authStore";
import styles from "./_layout.module.css";
import "./_layout.css";

/**
 * Timeout (ms) to wait for the Frak SDK to initialize.
 * If wallet status is still unknown after this, force re-auth.
 */
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

    // Timeout: if the SDK never initializes (iframe blocked,
    // popup context, etc.), force re-auth after a delay.
    useEffect(() => {
        const timer = setTimeout(() => setSdkTimedOut(true), sdkInitTimeout);
        return () => clearTimeout(timer);
    }, []);

    // Redirect to auth when:
    //  1. Wallet status resolved to "not-connected", OR
    //  2. SDK timed out without resolving
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
        <main className={styles.main}>
            <Outlet />
        </main>
    );
}
