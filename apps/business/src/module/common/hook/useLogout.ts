import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { useDemoMode } from "@/module/common/atoms/demoMode";
import { useAuthStore } from "@/stores/authStore";

/**
 * Clears the session and returns to the login page. Exiting demo mode already
 * wipes auth, so the explicit `clearAuth` only runs for real sessions.
 */
export function useLogout(): () => void {
    const navigate = useNavigate();
    const { isDemoMode, setDemoMode } = useDemoMode();

    return useCallback(() => {
        if (isDemoMode) {
            setDemoMode(false);
        } else {
            useAuthStore.getState().clearAuth();
        }
        navigate({ to: "/login" });
    }, [isDemoMode, setDemoMode, navigate]);
}
