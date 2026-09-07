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

/**
 * Codes a queued action can never satisfy on a later launch: the stored
 * shape lacks a credential the route now demands, and nothing on the retry
 * path can mint one. The wallet holds no signing key, so a rejected proof
 * and an expired ticket are as terminal as an absent one.
 */
const MISSING_CREDENTIAL_CODES = [
    "PROOF_REQUIRED",
    "PROOF_OR_TOKEN_REQUIRED",
    "MISSING_ANONYMOUS_ID",
    "RESERVED_IDENTITY",
    "PROOF_INVALID",
    "INVALID_TICKET",
] as const;

function errorCode(error: unknown): string | undefined {
    return (error as { value?: { code?: string } } | undefined)?.value?.code;
}

function isNonRetryable(error: unknown): boolean {
    const code = errorCode(error);
    if (code === WALLET_ALREADY_LINKED) return true;
    return MISSING_CREDENTIAL_CODES.some((known) => known === code);
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
 * action queued for the next launch, except a non-retryable one which is
 * dropped immediately.
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
                    // The toast copy names a wallet conflict, so only that
                    // code may raise it.
                    if (errorCode(err) === WALLET_ALREADY_LINKED) {
                        ensureConflictStore.getState().raise();
                    }
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
    // The backend resolves ticket -> proof+anonymousId -> bare anonymousId.
    // Once ENSURE_BARE_ARM_ENABLED is disabled the bare arm answers 400
    // PROOF_OR_TOKEN_REQUIRED and the proof arm 403 PROOF_INVALID; both are
    // non-retryable, so a stale action drops instead of burning its full TTL.
    const { error } = await authenticatedBackendApi.user.identity.ensure.post({
        merchantId: action.merchantId,
        ...(action.anonymousId && { anonymousId: action.anonymousId }),
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
