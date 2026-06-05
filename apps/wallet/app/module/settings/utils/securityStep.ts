export type SecurityStepKey =
    | "addEmail"
    | "verifyEmail"
    | "setupRecovery"
    | "updateRecovery"
    | "secured";

export type SecurityStepTarget =
    | "/profile/add-email"
    | "/profile/verify-email"
    | "/profile/recovery";

export type SecurityStep = {
    key: SecurityStepKey;
    /** Completion shown on the bar + percentage label (0-100). */
    percent: number;
    /** Where the call-to-action button takes the user. */
    to: SecurityStepTarget;
    /** Terminal state: nothing left to do, the wallet is fully protected. */
    secured: boolean;
};

export type SecuritySignals = {
    hasEmail: boolean;
    isEmailVerified: boolean;
    hasRecovery: boolean;
    recoveryExpiringSoon: boolean;
};

/**
 * Collapse the wallet's email + recovery signals into a single security step.
 * The branch order is the funnel itself — add an email, verify it, set recovery
 * up, keep it fresh, then "secured". Kept pure (no hooks) so the whole mapping
 * is unit-testable without a router or query client.
 */
export function resolveSecurityStep({
    hasEmail,
    isEmailVerified,
    hasRecovery,
    recoveryExpiringSoon,
}: SecuritySignals): SecurityStep {
    if (!hasEmail) {
        return {
            key: "addEmail",
            percent: 0,
            to: "/profile/add-email",
            secured: false,
        };
    }
    if (!isEmailVerified) {
        return {
            key: "verifyEmail",
            percent: 25,
            to: "/profile/verify-email",
            secured: false,
        };
    }
    if (!hasRecovery) {
        return {
            key: "setupRecovery",
            percent: 75,
            to: "/profile/recovery",
            secured: false,
        };
    }
    if (recoveryExpiringSoon) {
        return {
            key: "updateRecovery",
            percent: 75,
            to: "/profile/recovery",
            secured: false,
        };
    }
    return {
        key: "secured",
        percent: 100,
        to: "/profile/recovery",
        secured: true,
    };
}
