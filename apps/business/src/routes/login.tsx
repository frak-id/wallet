import { createFileRoute } from "@tanstack/react-router";
import { redirectIfAuthenticated } from "@/middleware/auth";
import { Login } from "@/module/login/component/Login";
import { main } from "./login.css";

export const Route = createFileRoute("/login")({
    beforeLoad: redirectIfAuthenticated,
    component: LoginPage,
});

function LoginPage() {
    return (
        <main className={main}>
            <Login />
        </main>
    );
}
