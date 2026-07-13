import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { InviteAccept } from "@/module/auth/component/InviteAccept";
import { Login } from "@/module/login/component/Login";
import { main } from "./login.css";

/**
 * Deep-link landing page for a merchant-team invitation email
 * (`#token=…`). Public route — no auth guard: the token itself is
 * the credential, and an already-authenticated visitor is handled inline
 * (`InviteAccept`) rather than being redirected away. The token rides in the
 * URL hash so it never reaches the server (same convention as
 * `/login/2fa#token=` and `/verify-email#code=`).
 */
export const Route = createFileRoute("/invite")({
    component: InvitePage,
});

function InvitePage() {
    const [token] = useState(readTokenFromHash);

    // Scrub the 7-day claim credential from the address bar/history right
    // after reading it (same convention as `PendingTwoFactor`'s `#token=`
    // adoption) — it's already captured in component state, so this doesn't
    // affect the flow, only what stays visible/persisted in the browser.
    useEffect(() => {
        if (!token) return;
        window.history.replaceState(null, "", window.location.pathname);
    }, [token]);

    return (
        <main className={main}>
            <Login>
                <InviteAccept token={token} />
            </Login>
        </main>
    );
}

function readTokenFromHash(): string | undefined {
    if (typeof window === "undefined") return undefined;
    const token = new URLSearchParams(window.location.hash.slice(1)).get(
        "token"
    );
    return token ?? undefined;
}
