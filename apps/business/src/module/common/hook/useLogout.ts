import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { authenticatedBackendApi } from "@/api/backendClient";
import { useDemoMode } from "@/module/common/atoms/demoMode";
import { useAuthStore } from "@/stores/authStore";

/**
 * Exiting demo mode already wipes auth, so `clearAuth` only runs for real
 * sessions. The server-side revoke is best-effort: a failure must never block
 * the client from clearing its own local session.
 */
export function useLogout(): () => void {
    const navigate = useNavigate();
    const { isDemoMode, setDemoMode } = useDemoMode();

    return useCallback(() => {
        if (isDemoMode) {
            setDemoMode(false);
        } else {
            authenticatedBackendApi.auth.logout.post().catch(() => {});
            useAuthStore.getState().clearAuth();
        }
        navigate({ to: "/login" });
    }, [isDemoMode, setDemoMode, navigate]);
}
