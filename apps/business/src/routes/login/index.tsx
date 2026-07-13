import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { Login } from "@/module/login/component/Login";

const parentApi = getRouteApi("/login");

export const Route = createFileRoute("/login/")({
    component: LoginPage,
});

function LoginPage() {
    // `redirect`/`error` are validated on the parent layout route.
    const { redirect, error } = parentApi.useSearch();
    return <Login redirect={redirect} error={error} />;
}
