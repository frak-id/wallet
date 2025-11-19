import { redirect } from "@tanstack/react-router";
import { getAuthToken, getWallet, isDemoMode } from "@/context/auth/authEnv";
import { useAuthStore } from "@/stores/authStore";

/**
 * Check if user is authenticated (works on both server and client)
 */
async function isAuthenticated(): Promise<boolean> {
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

    // Server-side: assume token is valid (will be verified by authMiddleware)
    if (typeof window === "undefined") {
        return true;
    }

    // Client-side: check expiration
    const expiresAt = useAuthStore.getState().expiresAt;
    if (!expiresAt) {
        return false;
    }

    return Date.now() < expiresAt;
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
    const authenticated = await isAuthenticated();

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
export async function redirectIfAuthenticated() {
    const authenticated = await isAuthenticated();

    if (authenticated) {
        throw redirect({
            to: "/dashboard",
        });
    }
}
