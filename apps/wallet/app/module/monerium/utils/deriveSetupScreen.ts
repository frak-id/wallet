import type { MoneriumStatusResponse } from "@backend-domain/monerium/schemas";

export type MoneriumSetupScreen =
    | "loading"
    | "info"
    | "reconnect"
    | "onboarding"
    | "verification"
    | "blocked"
    | "link"
    | "linking"
    | "success"
    | "transfer";

export type MoneriumStatus = MoneriumStatusResponse;

/** Maps the server status to the screen the bank flow must open on. */
export function deriveSetupScreen(
    status: MoneriumStatus | undefined,
    hasSeenSetupSuccess: boolean
): MoneriumSetupScreen {
    if (!status) return "loading";
    if (status.connection === "none") return "info";
    if (status.connection === "reauth_required") return "reconnect";

    switch (status.profile?.state) {
        case undefined:
        case "created":
        case "incomplete":
            return "onboarding";
        case "pending":
        case "review":
            return "verification";
        case "rejected":
        case "closed":
            return "blocked";
        case "approved":
            break;
    }

    if (status.walletLink === "none") return "link";
    if (status.walletLink === "pending") return "linking";
    return hasSeenSetupSuccess ? "transfer" : "success";
}

const POLLED_PROFILE_STATES = new Set([
    "created",
    "incomplete",
    "pending",
    "review",
]);

/** No webhooks on the OAuth plan: a pending profile or link is only noticed by asking. */
export function isMoneriumStatusPending(
    status: MoneriumStatus | undefined
): boolean {
    if (status?.connection !== "connected") return false;
    return (
        (status.profile !== null &&
            POLLED_PROFILE_STATES.has(status.profile.state)) ||
        status.walletLink === "pending"
    );
}
