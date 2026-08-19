/**
 * Pending ensure action — merge an anonymous identity with the wallet
 * via the /ensure endpoint after authentication.
 */
type PendingEnsureAction = {
    type: "ensure";
    merchantId: string;
    /**
     * Absent on a ticket-carrying action: the ticket resolves its own id
     * server-side, so the wallet never needs to name one.
     */
    anonymousId?: string;
    /** Optional merchant metadata for UI display */
    merchant?: { name: string; domain: string };
    /**
     * Install ticket minted by `install-code/resolve`. When present the
     * backend prefers it over `anonymousId`; absent on old-shape actions
     * written by a pre-ticket binary.
     */
    ticket?: string;
    /**
     * `frak-install-v1` proof, read from the `#p=` install-link fragment or
     * the Play referrer's `proof=` key. Sent alongside
     * `merchantId`/`anonymousId` on `/identity/ensure`, binding exactly
     * those two fields.
     * ROLLOUT-STEP-3: gated by ENSURE_BARE_ARM_ENABLED, not by a release.
     */
    proof?: string;
};

/**
 * Pending navigation action — navigate to a specific route after auth.
 * Also used for pairing (navigate to /pairing?id=xxx after auth).
 */
type PendingNavigationAction = {
    type: "navigation";
    to: string;
    search?: Record<string, string>;
};

/**
 * Union of all pending action types with metadata.
 */
export type PendingAction = (PendingEnsureAction | PendingNavigationAction) & {
    id: string;
    createdAt: number;
    expiresAt: number;
};

/**
 * Input type for adding actions — id, createdAt, expiresAt are auto-generated.
 */
export type PendingActionInput = PendingEnsureAction | PendingNavigationAction;
