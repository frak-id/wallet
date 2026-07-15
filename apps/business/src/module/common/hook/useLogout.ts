import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { authenticatedBackendApi } from "@/api/backendClient";
import { useDemoMode } from "@/module/common/atoms/demoMode";
import { useAuthStore } from "@/stores/authStore";

/**
 * Clears the session and returns to the login page. Exiting demo mode already
 * wipes auth, so the explicit `clearAuth` only runs for real sessions.
 *
 * `POST /auth/logout` (§5 deliverable 7) revokes the DB session server-side
 * — best-effort: a failure (network, already-expired token) must never
 * block the client from clearing its own local session.
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
