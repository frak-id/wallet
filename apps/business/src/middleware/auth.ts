import { redirect } from "@tanstack/react-router";
import { getSession } from "@/context/auth/session";

/**
 * beforeLoad hook for protected routes
 * Use this in route definitions to require authentication
 */
export async function requireAuth({
    location,
}: {
    location: { href: string };
}) {
    const session = await getSession();
    if (!session) {
        throw redirect({
            to: "/login",
            search: {
                redirect: location.href,
            },
        });
    }
    return { session };
}

/**
 * beforeLoad hook for login route
 * Redirects to dashboard if already authenticated
 */
export async function redirectIfAuthenticated() {
    const session = await getSession();
    if (session) {
        throw redirect({
            to: "/dashboard",
        });
    }
}
