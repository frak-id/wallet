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
     * Install ticket minted by `install-code/resolve`. When present the
     * backend prefers it over `anonymousId`; absent on old-shape actions
     * written by a pre-ticket binary.
     */
    ticket?: string;
    /**
     * `frak-install-v1` proof (README §2.2/§4.4), read from the `#p=`
     * install-link fragment or the Play referrer's `proof=` key. Sent
     * alongside `merchantId`/`anonymousId` on `/identity/ensure` — the
     * wallet arm already accepts it (DUAL-ARM-PLAN.md D-B): it binds exactly
     * `merchantId` ‖ `anonymousId`, which is what that arm authenticates.
     * No exchange, no extra round-trip; every arm (legacy pair, ticket,
     * proof) travels together on the same action.
     * ROLLOUT-STEP-3: revisit once the bare `anonymousId` arm is deleted —
     * see the note at `ensure.ts`'s wallet arm.
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
