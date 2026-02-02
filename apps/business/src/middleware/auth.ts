import { redirect } from "@tanstack/react-router";
import { getAuthToken, getWallet, isDemoMode } from "@/config/auth";
import { useAuthStore } from "@/stores/authStore";

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
    const token = getAuthToken();
    const isDemo = isDemoMode();

    // Demo mode is always "authenticated"
    if (isDemo) {
        return true;
    }

    // No token = not authenticated
    if (!token) {
        return false;
    }

    // Check expiration
    return useAuthStore.getState().isAuthenticated();
}

/**
 * beforeLoad hook for protected routes
 * Use this in route definitions to require authentication
 * Works correctly during both SSR and client-side navigation
 */
export async function requireAuth({
    location,
}: {
    location: { href: string };
}) {
    const authenticated = isAuthenticated();

    if (!authenticated) {
        throw redirect({
            to: "/login",
            search: {
                redirect: location.href,
            },
        });
    }

    const wallet = await getWallet();

    return {
        session: {
            wallet,
        },
    };
}

/**
 * beforeLoad hook for login route
 * Redirects to dashboard if already authenticated
 * Works correctly during both SSR and client-side navigation
 */
export function redirectIfAuthenticated() {
    const authenticated = isAuthenticated();

    if (authenticated) {
        throw redirect({
            to: "/dashboard",
        });
    }
}
