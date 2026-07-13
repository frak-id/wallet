import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { isAuthenticated, requireAuth } from "@/middleware/auth";
import { Header } from "@/module/common/component/Header";
import { Navigation } from "@/module/common/component/Navigation";
import { WelcomePopup } from "@/module/common/component/WelcomePopup";
import { useIsBareShell } from "@/module/common/hook/useIsBareShell";
import { useAuthStore } from "@/stores/authStore";
import "@/styles/restricted.css";
import { main } from "./_restricted.css";

export const Route = createFileRoute("/_restricted")({
    beforeLoad: requireAuth,
    component: RestrictedLayoutRoute,
});

/**
 * `requireAuth` only gates on navigation (`beforeLoad`). When a 401 mid-session
 * wipes the token (`backendClient` → `clearAuth`), no navigation occurs, so the
 * shell stays rendered while every request fails. Subscribe to the auth state
 * and kick the user to `/login` the moment the session dies.
 */
function useSessionExpiryRedirect() {
    const navigate = useNavigate();
    // Subscribe to the fields `isAuthenticated()` reads so this re-runs when a
    // 401 clears the token or the session expires.
    const token = useAuthStore((state) => state.token);
    const expiresAt = useAuthStore((state) => state.expiresAt);
    const pending2fa = useAuthStore((state) => state.pending2fa);

    useEffect(() => {
        if (isAuthenticated()) return;
        navigate({ to: "/login", replace: true });
    }, [navigate, token, expiresAt, pending2fa]);
}

function RestrictedLayoutRoute() {
    useSessionExpiryRedirect();
    const isBare = useIsBareShell();

    if (isBare) {
        return (
            <main>
                <Outlet />
            </main>
        );
    }

    return (
        <>
            <Header />
            <Navigation />
            <main className={main}>
                <Outlet />
            </main>
            <WelcomePopup />
        </>
    );
}
