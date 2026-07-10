import { createFileRoute } from "@tanstack/react-router";
import { redirectIfAuthenticated } from "@/middleware/auth";
import { Login } from "@/module/login/component/Login";
import { main } from "./login.css";

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
    component: LoginPage,
});

function LoginPage() {
    const { redirect, error } = Route.useSearch();
    return (
        <main className={main}>
            <Login redirect={redirect} error={error} />
        </main>
    );
}
