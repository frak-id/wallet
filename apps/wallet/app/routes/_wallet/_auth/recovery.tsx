import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { RecoveryUsageFlow } from "@/module/recovery/component/RecoveryFlow";

export const Route = createFileRoute("/_wallet/_auth/recovery")({
    component: RecoveryPage,
});

/**
 * Wallet recovery for users who can't log in. An optional `#blob=…` hash lets a
 * recovery link prefill the backup and jump straight to the password step; the
 * fragment never reaches the server.
 */
function RecoveryPage() {
    const [initialBlob] = useState(readBlobFromHash);
    return <RecoveryUsageFlow initialBlob={initialBlob} />;
}

function readBlobFromHash(): string | undefined {
    if (typeof window === "undefined") return undefined;
    const blob = new URLSearchParams(window.location.hash.slice(1)).get("blob");
    return blob ?? undefined;
}
