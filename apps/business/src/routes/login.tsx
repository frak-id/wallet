import { createFileRoute } from "@tanstack/react-router";
import { redirectIfAuthenticated } from "@/middleware/auth";
import { AuthLayout } from "@/module/common/component/AuthLayout";
import { Login } from "@/module/login/component/Login";

export const Route = createFileRoute("/login")({
    beforeLoad: redirectIfAuthenticated,
    component: LoginPage,
});

function LoginPage() {
    return (
        <AuthLayout>
            <Login />
        </AuthLayout>
    );
}
