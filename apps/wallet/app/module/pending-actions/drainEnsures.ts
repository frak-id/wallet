import type { InstallSource } from "@frak-labs/wallet-shared/common/analytics";
import {
    recordError,
    trackEvent,
} from "@frak-labs/wallet-shared/common/analytics";
import { authenticatedBackendApi } from "@frak-labs/wallet-shared/common/api/backendClient";
import { ensureConflictStore } from "@/module/pending-actions/stores/ensureConflictStore";
import { pendingActionsStore } from "@/module/pending-actions/stores/pendingActionsStore";
import type {
    PendingAction,
    PendingActionInput,
} from "@/module/pending-actions/types";

type EnsureAction = Extract<PendingAction, { type: "ensure" }>;

/**
 * The anonymous id is already linked to a different wallet, so retrying can
 * never succeed. `ensure.ts` remaps its internal `WALLET_CONFLICT` to this
 * code before it reaches the client.
 */
const WALLET_ALREADY_LINKED = "WALLET_ALREADY_LINKED";

function isNonRetryable(error: unknown): boolean {
    const code = (error as { value?: { code?: string } } | undefined)?.value
        ?.code;
    return code === WALLET_ALREADY_LINKED;
}

/**
 * Queue `newAction` (deduped, persisted, survives crashes) and return every
 * still-valid pending action.
 */
export function queuePendingAction(
    newAction?: PendingActionInput
): PendingAction[] {
    const store = pendingActionsStore.getState();
    if (newAction) store.addAction(newAction);
    return store.getValidActions();
}

/**
 * Fire every ensure action in `actions`, fire-and-forget: a failure keeps the
 * action queued for the next launch, except a non-retryable
 * `WALLET_ALREADY_LINKED` which is dropped immediately.
 *
 * Router-free on purpose — the standalone `/install` entrypoint has no
 * TanStack Router, and this is the only half of the pending-actions drain it
 * needs.
 */
export function fireEnsureActions(
    actions: PendingAction[],
    newAction?: PendingActionInput
): void {
    const store = pendingActionsStore.getState();
    const ensureActions = actions.filter(
        (a): a is EnsureAction => a.type === "ensure"
    );

    for (const action of ensureActions) {
        const source = inferEnsureSource(action, newAction);
        const startedAt = Date.now();
        trackEvent("identity_ensure_executed", { source });
        executeEnsure(action).then(
            () => {
                trackEvent("identity_ensure_succeeded", {
                    source,
                    duration_ms: Date.now() - startedAt,
                });
                store.removeAction(action.id);
            },
            (err) => {
                const nonRetryable = isNonRetryable(err);
                trackEvent("identity_ensure_failed", {
                    source,
                    error_type: err instanceof Error ? err.name : "unknown",
                    non_retryable: nonRetryable,
                });
                recordError(err, {
                    source: "pending_actions",
                    context: { action_type: "ensure", source },
                });
                if (nonRetryable) {
                    // Stop the retry loop instead of silently no-oping on
                    // every future app launch.
                    store.removeAction(action.id);
                    ensureConflictStore.getState().raise();
                }
            }
        );
    }
}

/**
 * Execute a single ensure action against the backend. Rejects with the raw
 * Eden Treaty error object (not a stringified `Error`) so callers can read
 * `.value.code` to distinguish a non-retryable conflict from a transient
 * failure.
 */
async function executeEnsure(action: EnsureAction): Promise<void> {
    // `merchantId`/`anonymousId` always sent, `ticket` and `proof` added on
    // top when present. The backend resolves ticket -> proof+anonymousId ->
    // bare anonymousId, so an old-shape action with neither still works.
    // ROLLOUT-STEP-3.
    const { error } = await authenticatedBackendApi.user.identity.ensure.post({
        merchantId: action.merchantId,
        anonymousId: action.anonymousId,
        ...(action.ticket && { ticket: action.ticket }),
        ...(action.proof && { proof: action.proof }),
    });

    if (error) {
        throw error;
    }
}

/**
 * Infer the attribution source for an ensure action. If `newAction` matches
 * the action being executed, it came from the current caller (install page
 * URL params, referrer, or magic code); otherwise it was restored from the
 * persisted queue on a later launch.
 */
function inferEnsureSource(
    action: EnsureAction,
    newAction?: PendingActionInput
): InstallSource {
    if (
        newAction?.type === "ensure" &&
        newAction.merchantId === action.merchantId &&
        newAction.anonymousId === action.anonymousId
    ) {
        return "url_params";
    }
    return "stored";
}
