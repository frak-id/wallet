import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { VerifyEmail } from "@/module/email-verification/component/VerifyEmail";

export const Route = createFileRoute(
    "/_wallet/_protected-fullscreen/profile/verify-email"
)({
    component: ProfileVerifyEmail,
});

/**
 * An optional `#code=…` hash lets the verification email's "Verify my email"
 * button prefill + auto-submit the code; the fragment never reaches the server.
 */
function ProfileVerifyEmail() {
    const [initialCode] = useState(readCodeFromHash);
    return <VerifyEmail initialCode={initialCode} />;
}

function readCodeFromHash(): string | undefined {
    if (typeof window === "undefined") return undefined;
    const code = new URLSearchParams(window.location.hash.slice(1)).get("code");
    return code ?? undefined;
}
