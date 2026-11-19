import {
    getErrorStatus,
    REDEEM_ERROR_KEY_MAP,
    type UnknownCodeOutcome,
} from "@frak-labs/wallet-shared";
import { useCallback } from "react";
import { useExecutePendingActions } from "@/module/pending-actions/hook/useExecutePendingActions";
import { useResolveInstallCode } from "@/module/reward-code/hook/useResolveInstallCode";

type Merchant = { name: string; domain: string };

/**
 * `onUnknownCode` for an authenticated referral field: resolves the code as an
 * install code and drains its ensure at once, since no later login will.
 */
export function useInstallCodeFallback(
    onResolved: (merchant: Merchant) => void
) {
    const { resolveAsync } = useResolveInstallCode({
        surface: "referral_code",
    });
    const { executePendingActions } = useExecutePendingActions();

    return useCallback(
        async (code: string): Promise<UnknownCodeOutcome> => {
            let result: Awaited<ReturnType<typeof resolveAsync>>;
            try {
                result = await resolveAsync(code);
            } catch (error) {
                // Only a 404 means "no install code"; a 429, 5xx or offline must not read as "doesn't exist".
                return getErrorStatus(error) === 404
                    ? "unknown"
                    : { errorKey: REDEEM_ERROR_KEY_MAP.fallback };
            }
            if (result.outcome === "UNRESOLVED") {
                return { errorKey: "rewardCode.error.unresolved" };
            }
            executePendingActions({ skipNavigation: true });
            onResolved(result.merchant);
            return "handled";
        },
        [resolveAsync, executePendingActions, onResolved]
    );
}
