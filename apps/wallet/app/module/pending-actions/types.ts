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
};

/**
 * Pending navigation action — navigate to a specific route after auth.
 * Replaces the volatile `pendingDeepLink` variable.
 */
type PendingNavigationAction = {
    type: "navigation";
    to: string;
    search?: Record<string, string>;
};

/**
 * Pending pairing action — initiate device pairing after auth.
 * Replaces `pendingPairingId` in the old pairingStore.
 */
type PendingPairingAction = {
    type: "pairing";
    pairingId: string;
};

/**
 * Union of all pending action types with metadata.
 */
export type PendingAction = (
    | PendingEnsureAction
    | PendingNavigationAction
    | PendingPairingAction
) & {
    id: string;
    createdAt: number;
    expiresAt: number;
};

/**
 * Input type for adding actions — id, createdAt, expiresAt are auto-generated.
 */
export type PendingActionInput =
    | PendingEnsureAction
    | PendingNavigationAction
    | PendingPairingAction;
