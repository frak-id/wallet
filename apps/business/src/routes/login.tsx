import { createFileRoute, Outlet } from "@tanstack/react-router";
import { redirectIfAuthenticated } from "@/middleware/auth";
import { main } from "./login.css";

/**
 * Layout for the login tree (`/login`, `/login/2fa`). MUST render an
 * `<Outlet/>`: `/login/2fa` is a child route — without the outlet the
 * pending-2FA completion screen silently never mounts and every
 * password/Shopify login strands on the login page.
 */
export const Route = createFileRoute("/login")({
    beforeLoad: redirectIfAuthenticated,
    // Keys are emitted only when present so both stay optional — navigations
    // to `/login` (logout, guards) don't have to supply them.
    validateSearch: (
        search: Record<string, unknown>
    ): { redirect?: string; error?: string } => ({
        ...(typeof search.redirect === "string"
            ? { redirect: search.redirect }
            : {}),
        // Set by the Shopify SSO callback on a failed exchange (§4.7).
        ...(typeof search.error === "string" ? { error: search.error } : {}),
    }),
    component: LoginLayout,
});

function LoginLayout() {
    return (
        <main className={main}>
            <Outlet />
        </main>
    );
}
