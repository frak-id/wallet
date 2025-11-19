import { redirect } from "@tanstack/react-router";
import { useAuthStore } from "@/stores/authStore";
import { demoModeStore } from "@/stores/demoModeStore";

/**
 * beforeLoad hook for protected routes
 * Use this in route definitions to require authentication
 */
export async function requireAuth({
    location,
}: {
    location: { href: string };
}) {
    const isAuthenticated = useAuthStore.getState().isAuthenticated();
    const isDemoMode = demoModeStore.getState().isDemoMode;

    // Allow access if authenticated OR in demo mode
    if (!isAuthenticated && !isDemoMode) {
        throw redirect({
            to: "/login",
            search: {
                redirect: location.href,
            },
        });
    }

    return {
        session: {
            wallet: useAuthStore.getState().wallet!,
        },
    };
}

/**
 * beforeLoad hook for login route
 * Redirects to dashboard if already authenticated
 */
export async function redirectIfAuthenticated() {
    const isAuthenticated = useAuthStore.getState().isAuthenticated();

    if (isAuthenticated) {
        throw redirect({
            to: "/dashboard",
        });
    }
}
