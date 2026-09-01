import type { UseMutationOptions } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
    fireEnsureActions,
    queuePendingAction,
} from "@/module/pending-actions/drainEnsures";
import { pendingActionsKey } from "@/module/pending-actions/queryKeys/pendingActions";
import { pendingActionsStore } from "@/module/pending-actions/stores/pendingActionsStore";
import type {
    PendingAction,
    PendingActionInput,
} from "@/module/pending-actions/types";

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
 *
 * The queue + ensure half lives in `../drainEnsures` so the router-free
 * `/install` entrypoint can reuse it without pulling TanStack Router in.
 */
export function useExecutePendingActions(
    options?: UseMutationOptions<boolean, Error, ExecutePendingActionsArgs>
) {
    const navigate = useNavigate();

    const { mutateAsync: executePendingActions, ...mutation } = useMutation({
        ...options,
        mutationKey: pendingActionsKey.execute,
        mutationFn: async (args?: ExecutePendingActionsArgs) => {
            const newAction =
                args && "newAction" in args ? args.newAction : undefined;
            const skipNavigation =
                args && "skipNavigation" in args ? args.skipNavigation : false;

            const actions = queuePendingAction(newAction);
            if (actions.length === 0) return false;

            // 1. Fire-and-forget: execute all ensure actions in background
            fireEnsureActions(actions, newAction);

            // 2. Navigation actions (pairing, deep link redirects, etc.)
            if (skipNavigation) return false;

            const navigationAction = actions.find(
                (a): a is Extract<PendingAction, { type: "navigation" }> =>
                    a.type === "navigation"
            );
            if (navigationAction) {
                pendingActionsStore
                    .getState()
                    .removeAction(navigationAction.id);
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
