import { authenticatedBackendApi } from "@frak-labs/wallet-shared";
import { pendingActionsStore } from "@/module/pending-actions/stores/pendingActionsStore";
import type { PendingAction } from "@/module/pending-actions/types";

type NavigateFn = (options: {
    to: string;
    search?: Record<string, string>;
    replace?: boolean;
}) => unknown;

/**
 * Execute all pending actions after successful authentication.
 *
 * Call this from both login and register post-auth callbacks.
 *
 * Execution order:
 *   1. ensure actions  → silent background API calls (non-blocking)
 *   2. pairing actions → navigate to /pairing (pairing page consumes the action)
 *   3. navigation actions → navigate to target
 *
 * Returns `true` if a navigation was triggered (pairing or explicit navigation),
 * `false` if no redirect-type actions were found — caller should apply default
 * navigation (e.g. navigate to /wallet).
 */
export async function executePendingActions(
    navigate: NavigateFn
): Promise<boolean> {
    const store = pendingActionsStore.getState();
    const actions = store.getValidActions();

    if (actions.length === 0) {
        return false;
    }

    // 1. Fire-and-forget: execute all ensure actions in background
    const ensureActions = actions.filter(
        (a): a is Extract<PendingAction, { type: "ensure" }> =>
            a.type === "ensure"
    );
    for (const action of ensureActions) {
        executeEnsure(action).then(
            () => store.removeAction(action.id),
            (error) => {
                console.error(
                    "[PendingActions] Ensure failed, keeping for retry on next launch:",
                    error
                );
            }
        );
    }

    // 2. Pairing takes priority for navigation
    const pairingAction = actions.find(
        (a): a is Extract<PendingAction, { type: "pairing" }> =>
            a.type === "pairing"
    );
    if (pairingAction) {
        // Don't remove — the pairing page needs to read the pairingId,
        // it will call clearPendingPairing() when done.
        navigate({
            to: "/pairing",
            search: { mode: "embedded" },
            replace: true,
        });
        return true;
    }

    // 3. Navigation actions (deep link redirects, etc.)
    const navigationAction = actions.find(
        (a): a is Extract<PendingAction, { type: "navigation" }> =>
            a.type === "navigation"
    );
    if (navigationAction) {
        store.removeAction(navigationAction.id);
        navigate({
            to: navigationAction.to,
            search: navigationAction.search,
            replace: true,
        });
        return true;
    }

    return false;
}

/**
 * Execute a single ensure action against the backend.
 */
async function executeEnsure(
    action: Extract<PendingAction, { type: "ensure" }>
): Promise<void> {
    const { error } = await authenticatedBackendApi.user.identity.ensure.post({
        merchantId: action.merchantId,
        anonymousId: action.anonymousId,
    });

    if (error) {
        throw new Error(`Ensure failed: ${JSON.stringify(error)}`);
    }
}
