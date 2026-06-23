import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { VerifyEmail } from "@/module/email-verification/component/VerifyEmail";

type VerifyEmailSearch = {
    mode?: "change";
};

export const Route = createFileRoute(
    "/_wallet/_protected-fullscreen/profile/verify-email"
)({
    validateSearch: (search: Record<string, unknown>): VerifyEmailSearch => ({
        mode: search.mode === "change" ? "change" : undefined,
    }),
    component: ProfileVerifyEmail,
});

/**
 * An optional `#code=…` hash lets the verification email's "Verify my email"
 * button prefill + auto-submit the code; the fragment never reaches the server.
 * `?mode=change` opens the change-email form directly (profile entry point).
 */
function ProfileVerifyEmail() {
    const { mode } = Route.useSearch();
    const [initialCode] = useState(readCodeFromHash);
    return (
        <VerifyEmail
            initialCode={initialCode}
            startInChangeEmail={mode === "change"}
        />
    );
}

function readCodeFromHash(): string | undefined {
    if (typeof window === "undefined") return undefined;
    const code = new URLSearchParams(window.location.hash.slice(1)).get("code");
    return code ?? undefined;
}
