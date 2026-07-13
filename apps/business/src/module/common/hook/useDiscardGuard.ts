import { useCallback, useState } from "react";
import { useTwoFactorStore } from "@/stores/twoFactorStore";

type UseDiscardGuardOptions = {
    isDirty: boolean;
    onDiscard?: () => void;
};

export function useDiscardGuard({
    isDirty,
    onDiscard,
}: UseDiscardGuardOptions) {
    const [pendingAction, setPendingAction] = useState<(() => void) | null>(
        null
    );

    // A step-up 2FA challenge (`stepUpAwareFetch`'s 401 retry) renders the
    // global `TwoFactorModal` in a portal *outside* the guarded sheet.
    // Clicking its input registers as an interact-outside/escape on the sheet,
    // which would otherwise pop the discard dialog on top of the 2FA modal —
    // and discarding wipes the very edit the challenge is authorising. So we
    // swallow every close/discard request while a challenge is live.
    const twoFactorActive = useTwoFactorStore(
        (state) => state.request !== null
    );

    const guard = useCallback(
        (action: () => void) => {
            // Scoped to the single portaled dialog that exists today. If other
            // dialogs ever stack over these sheets, generalise by having the
            // sheet's `onInteractOutside` ignore events whose target sits
            // inside another `[role="dialog"]` (DOM-layer detection) rather
            // than reading this store.
            if (twoFactorActive) return;
            if (!isDirty) {
                action();
                return;
            }
            setPendingAction(() => action);
        },
        [isDirty, twoFactorActive]
    );

    const handleKeepEditing = useCallback(() => {
        setPendingAction(null);
    }, []);

    const handleDiscard = useCallback(() => {
        onDiscard?.();
        const action = pendingAction;
        setPendingAction(null);
        action?.();
    }, [onDiscard, pendingAction]);

    return {
        guard,
        dialogProps: {
            open: pendingAction !== null,
            onKeepEditing: handleKeepEditing,
            onDiscard: handleDiscard,
        },
    };
}
