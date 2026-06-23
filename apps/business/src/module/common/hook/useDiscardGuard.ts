import { useCallback, useState } from "react";

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

    const guard = useCallback(
        (action: () => void) => {
            if (!isDirty) {
                action();
                return;
            }
            setPendingAction(() => action);
        },
        [isDirty]
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
