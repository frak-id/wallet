import {
    authenticatedBackendApi,
    type InstallSource,
    recordError,
    trackEvent,
} from "@frak-labs/wallet-shared";
import type { UseMutationOptions } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { pendingActionsKey } from "@/module/pending-actions/queryKeys/pendingActions";
import { ensureConflictStore } from "@/module/pending-actions/stores/ensureConflictStore";
import { pendingActionsStore } from "@/module/pending-actions/stores/pendingActionsStore";
import type {
    PendingAction,
    PendingActionInput,
} from "@/module/pending-actions/types";

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

type ExecutePendingActionsArgs = {
    newAction?: PendingActionInput;
    /**
     * When true, only execute logical actions (ensure calls) and skip navigation.
     * Used in the register flow to drain ensures immediately after auth
     * while letting the user finish onboarding before navigating.
     */
    skipNavigation?: boolean;
    // biome-ignore lint/suspicious/noConfusingVoidType: required for optional mutation arguments
} | void;

/**
 * Hook to execute all pending actions after authentication.
 *
 * Handles:
 *   - Storing a new action (optional, e.g. from /install)
 *   - Draining ensure actions (fire-and-forget, kept on failure for retry —
 *     except a non-retryable WALLET_ALREADY_LINKED, which is dropped
 *     immediately)
 *   - Navigating to pending navigation target (if any)
 *
 * Returns `true` via mutation data if a navigation was triggered,
 * `false` otherwise — callers should apply a default navigation when `false`.
 */
export function useExecutePendingActions(
    options?: UseMutationOptions<boolean, Error, ExecutePendingActionsArgs>
) {
    const navigate = useNavigate();

    const { mutateAsync: executePendingActions, ...mutation } = useMutation({
        ...options,
        mutationKey: pendingActionsKey.execute,
        mutationFn: async (args?: ExecutePendingActionsArgs) => {
            const store = pendingActionsStore.getState();
            const newAction =
                args && "newAction" in args ? args.newAction : undefined;
            const skipNavigation =
                args && "skipNavigation" in args ? args.skipNavigation : false;

            // Store new action first — deduped, persisted, survives crashes
            if (newAction) {
                store.addAction(newAction);
            }

            const actions = store.getValidActions();
            if (actions.length === 0) return false;

            // 1. Fire-and-forget: execute all ensure actions in background
            const ensureActions = actions.filter(
                (a): a is Extract<PendingAction, { type: "ensure" }> =>
                    a.type === "ensure"
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
                            error_type:
                                err instanceof Error ? err.name : "unknown",
                            non_retryable: nonRetryable,
                        });
                        recordError(err, {
                            source: "pending_actions",
                            context: { action_type: "ensure", source },
                        });
                        if (nonRetryable) {
                            // Stop the retry loop instead of silently
                            // no-oping on every future app launch.
                            store.removeAction(action.id);
                            ensureConflictStore.getState().raise();
                        }
                    }
                );
            }

            // 2. Navigation actions (pairing, deep link redirects, etc.)
            if (skipNavigation) return false;

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
        },
    });

    return { executePendingActions, ...mutation };
}

/**
 * Execute a single ensure action against the backend. Rejects with the raw
 * Eden Treaty error object (not a stringified `Error`) so callers can read
 * `.value.code` to distinguish a non-retryable conflict from a transient
 * failure.
 */
async function executeEnsure(
    action: Extract<PendingAction, { type: "ensure" }>
): Promise<void> {
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
    action: Extract<PendingAction, { type: "ensure" }>,
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
