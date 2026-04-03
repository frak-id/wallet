import { authenticatedBackendApi } from "@frak-labs/wallet-shared";
import { pendingActionsStore } from "@/module/pending-actions/stores/pendingActionsStore";
import type {
    PendingAction,
    PendingActionInput,
} from "@/module/pending-actions/types";

type NavigateFn = (options: {
    to: string;
    search?: Record<string, string>;
    replace?: boolean;
}) => unknown;

/**
 * Execute all pending actions.
 *
 * Can be called:
 *   - After login/register to drain persisted pending actions.
 *   - From a page (e.g. /install) with a `newAction` that should be
 *     stored first and executed immediately alongside any existing ones.
 *
 * When `newAction` is provided it is added to the store before draining,
 * so it benefits from deduplication, TTL, and automatic retry on failure
 * (the action stays in the store if execution fails).
 *
 * Execution order:
 *   1. ensure actions  → silent background API calls (non-blocking)
 *   2. navigation actions → navigate to target (pairing, deep links, etc.)
 *
 * Returns `true` if a navigation was triggered, `false` otherwise —
 * callers should apply a default navigation (e.g. /wallet) when `false`.
 */
export async function executePendingActions(
    navigate: NavigateFn,
    newAction?: PendingActionInput
): Promise<boolean> {
    const store = pendingActionsStore.getState();

    // Store the new action first — deduped, persisted, survives crashes
    if (newAction) {
        store.addAction(newAction);
    }

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

    // 2. Navigation actions (pairing, deep link redirects, etc.)
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
