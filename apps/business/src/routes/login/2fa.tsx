import { createFileRoute } from "@tanstack/react-router";
import { PendingTwoFactor } from "@/module/auth/component/PendingTwoFactor";

export const Route = createFileRoute("/login/2fa")({
    // Optional redirect carried from the password login so 2FA completion
    // lands on the originally-requested page (§2.5).
    validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
        typeof search.redirect === "string"
            ? { redirect: search.redirect }
            : {},
    component: PendingTwoFactor,
});
