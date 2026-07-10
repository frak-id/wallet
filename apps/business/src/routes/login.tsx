import { createFileRoute } from "@tanstack/react-router";
import { redirectIfAuthenticated } from "@/middleware/auth";
import { Login } from "@/module/login/component/Login";
import { main } from "./login.css";

export const Route = createFileRoute("/login")({
    beforeLoad: redirectIfAuthenticated,
    validateSearch: (search: Record<string, unknown>) => ({
        redirect: (search.redirect as string | undefined) ?? undefined,
        // Set by the Shopify SSO callback on a failed exchange (§4.7).
        error: (search.error as string | undefined) ?? undefined,
    }),
    component: LoginPage,
});

function LoginPage() {
    const { error } = Route.useSearch();
    return (
        <main className={main}>
            <Login error={error} />
        </main>
    );
}
