import type { MoneriumStatusResponse } from "@backend-domain/monerium/schemas";
import { isMoneriumProfileUsable } from "@frak-labs/app-essentials/monerium";

type MoneriumSetupScreen =
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

    const profileState = status.profile?.state;
    if (profileState === "rejected" || profileState === "closed") {
        return "blocked";
    }
    if (!isMoneriumProfileUsable(profileState, status.environment)) {
        return profileState === "pending" || profileState === "review"
            ? "verification"
            : "onboarding";
    }

    if (status.walletLink === "none") return "link";
    if (status.walletLink === "pending") return "linking";
    return hasSeenSetupSuccess ? "transfer" : "success";
}

const POLLED_SCREENS = new Set<MoneriumSetupScreen>([
    "onboarding",
    "verification",
    "linking",
]);

/** No webhooks on the OAuth plan: a pending profile or link is only noticed by asking. */
export function isMoneriumStatusPending(
    status: MoneriumStatus | undefined
): boolean {
    return POLLED_SCREENS.has(deriveSetupScreen(status, true));
}
