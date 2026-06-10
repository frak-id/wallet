import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { RecoveryUsageFlow } from "@/module/recovery/component/RecoveryFlow";

type RecoverySearch = {
    email?: string;
};

export const Route = createFileRoute("/_wallet/_auth/recovery")({
    component: RecoveryPage,
    validateSearch: (search: Record<string, unknown>): RecoverySearch => ({
        email: typeof search.email === "string" ? search.email : undefined,
    }),
});

/**
 * Wallet recovery for users who can't log in. An optional `#blob=…` hash lets a
 * recovery link prefill the backup and jump straight to the password step; the
 * fragment never reaches the server. An optional `?email=…` search param
 * prefills the recovery email input (e.g. coming from onboarding).
 */
function RecoveryPage() {
    const [initialBlob] = useState(readBlobFromHash);
    const { email } = Route.useSearch();
    return <RecoveryUsageFlow initialBlob={initialBlob} initialEmail={email} />;
}

function readBlobFromHash(): string | undefined {
    if (typeof window === "undefined") return undefined;
    const blob = new URLSearchParams(window.location.hash.slice(1)).get("blob");
    return blob ?? undefined;
}
