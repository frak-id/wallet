import { createFileRoute } from "@tanstack/react-router";
import { PendingTwoFactor } from "@/module/auth/component/PendingTwoFactor";

export const Route = createFileRoute("/login/2fa")({
    component: PendingTwoFactor,
});
