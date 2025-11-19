import { redirect } from "@tanstack/react-router";
import type { Address } from "viem";
import { useAuthStore } from "@/stores/authStore";

/**
 * beforeLoad hook for protected routes
 * Use this in route definitions to require authentication
 */
export async function requireAuth({
    location,
}: {
    location: { href: string };
}) {
    // On server, we cannot verify client-side auth (localStorage).
    // We allow the request to proceed to the client, where the check will run again.
    // This prevents infinite redirect loops during SSR when using client-side auth.
    if (typeof window === "undefined") {
        return {
            session: {
                // Return a zero address as a safe placeholder for the server-side render
                wallet: "0x0000000000000000000000000000000000000000" as Address,
            },
        };
    }

    const authState = useAuthStore.getState();
    const isAuthenticated = authState.isAuthenticated();
    const isDemoMode = authState.isDemoMode;

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
            wallet: authState.wallet!,
        },
    };
}

/**
 * beforeLoad hook for login route
 * Redirects to dashboard if already authenticated
 */
export async function redirectIfAuthenticated() {
    // Skip server-side check as we can't access localStorage
    if (typeof window === "undefined") {
        return;
    }

    const isAuthenticated = useAuthStore.getState().isAuthenticated();

    if (isAuthenticated) {
        throw redirect({
            to: "/dashboard",
        });
    }
}
