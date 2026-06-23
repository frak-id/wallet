import { createFileRoute } from "@tanstack/react-router";
import { LoginWithEmailPage } from "@/module/authentication/page/LoginWithEmailPage";

export const Route = createFileRoute("/_wallet/_auth/login/email")({
    component: LoginWithEmailPage,
});
