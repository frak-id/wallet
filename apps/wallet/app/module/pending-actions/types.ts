/**
 * Pending ensure action — merge an anonymous identity with the wallet
 * via the /ensure endpoint after authentication.
 */
type PendingEnsureAction = {
    type: "ensure";
    merchantId: string;
    anonymousId: string;
    /** Optional merchant metadata for UI display */
    merchant?: { name: string; domain: string };
    /**
     * Optional install ticket (README §5, "Ticket design"). Minted by
     * `install-code/resolve`. When present, the backend prefers it over
     * `anonymousId`; when absent (old-shape action written by a pre-ticket
     * binary), `anonymousId` is used exactly as before.
     */
    ticket?: string;
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
