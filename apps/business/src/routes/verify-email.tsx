import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { requireAuth } from "@/middleware/auth";
import { VerifyEmail } from "@/module/auth/component/VerifyEmail";
import { main } from "./login.css";

/**
 * Deep-link target for the verification email (`#code=…`). Requires a session
 * (the add-email flow is always authenticated); the code rides in the hash so
 * it never reaches the server. Reuses the login layout's centered `main`.
 */
export const Route = createFileRoute("/verify-email")({
    beforeLoad: requireAuth,
    component: VerifyEmailPage,
});

function VerifyEmailPage() {
    const [initialCode] = useState(readCodeFromHash);
    return (
        <main className={main}>
            <VerifyEmail initialCode={initialCode} />
        </main>
    );
}

function readCodeFromHash(): string | undefined {
    if (typeof window === "undefined") return undefined;
    const code = new URLSearchParams(window.location.hash.slice(1)).get("code");
    return code ?? undefined;
}
