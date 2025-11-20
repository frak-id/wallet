import { redirect } from "@tanstack/react-router";
import { useAuthStore } from "@/stores/authStore";

/**
 * Check if user is authenticated for embedded routes
 * Requires both wallet connection and valid JWT token
 * Note: This is client-side only as embedded routes don't run on server
 */
export function isEmbeddedAuthenticated(): boolean {
    return useAuthStore.getState().isAuthenticated();
}

/**
 * beforeLoad hook for embedded protected routes
 * Redirects to embedded auth page if not authenticated
 */
export async function requireEmbeddedAuth({
    location,
}: {
    location: { href: string };
}) {
    const authenticated = isEmbeddedAuthenticated();

    if (!authenticated) {
        throw redirect({
            to: "/embedded/auth",
            search: {
                redirect: location.href,
            },
        });
    }
}
