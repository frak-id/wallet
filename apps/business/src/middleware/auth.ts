import { redirect } from "@tanstack/react-router";
import { getAuthToken, getWallet, isDemoMode } from "@/config/auth";
import { safeRedirectTarget } from "@/module/auth/utils/safeRedirect";
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
 */
export function requireAuth({ location }: { location: { href: string } }) {
    const authenticated = isAuthenticated();

    if (!authenticated) {
        throw redirect({
            to: "/login",
            search: {
                redirect: location.href,
            },
        });
    }

    const wallet = getWallet();

    return {
        session: {
            wallet,
        },
    };
}

/**
 * beforeLoad hook for login route.
 * Redirects to the requested `redirect` target if already authenticated —
 * defaults to /dashboard when absent (the legacy redirect there resolves
 * the user's first merchant and lands on the new `/m/$merchantId/dashboard`
 * URL). Honoring `redirect` here means an already-authenticated user hitting
 * a Shopify deep-link (`/login?redirect=/m/x/campaigns` or
 * `/login/shopify?redirect=…`) lands directly on the intended page instead
 * of always bouncing to the generic dashboard.
 */
export function redirectIfAuthenticated({
    search,
}: {
    search?: { redirect?: string };
} = {}) {
    const authenticated = isAuthenticated();

    if (authenticated) {
        throw redirect({
            to: safeRedirectTarget(search?.redirect),
        });
    }
}
