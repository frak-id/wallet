import { isUserCancellation } from "@frak-labs/wallet-shared";
import { tryit } from "radash";
import { useCallback, useState } from "react";

export type RecoveryAuthorizationError = "cancelled" | "failed";

type AuthorizeResult<T> = { ok: true; value: T } | { ok: false };

/**
 * Shared error handling for an on-chain recovery authorization: run the tx
 * `action`, and on failure classify it as a user cancellation vs a real error
 * so callers render the right copy. Used by both the setup `SignStep` and the
 * date-refresh confirm step.
 */
export function useRecoveryAuthorization() {
    const [error, setError] = useState<RecoveryAuthorizationError | null>(null);

    const authorize = useCallback(
        async <T>(action: () => Promise<T>): Promise<AuthorizeResult<T>> => {
            setError(null);
            const [txError, value] = await tryit(action)();
            if (txError) {
                setError(isUserCancellation(txError) ? "cancelled" : "failed");
                return { ok: false };
            }
            return { ok: true, value };
        },
        []
    );

    return { error, authorize };
}
