import { useEffect, useRef } from "react";
import {
    useWebauthnErrorToastStore,
    type WebauthnToastOperation,
} from "../stores/webauthnErrorToastStore";

type UseWebauthnErrorToastOptions = {
    operation?: WebauthnToastOperation;
    /** Retry handler invoked by the toast action for retryable kinds. */
    onRetry?: () => void;
};

/**
 * Surfaces a WebAuthn error in the global top toast and clears it when the error
 * resolves or the host unmounts. Pass a falsy `error` for no toast. Safe to call
 * unconditionally at the top of a component.
 */
export function useWebauthnErrorToast(
    error: Error | null | undefined,
    options?: UseWebauthnErrorToastOptions
) {
    const show = useWebauthnErrorToastStore((state) => state.show);
    const dismiss = useWebauthnErrorToastStore((state) => state.dismiss);

    // Keep the latest options without re-firing the effect on every render —
    // `onRetry` is typically a fresh closure each render.
    const optionsRef = useRef(options);
    optionsRef.current = options;

    useEffect(() => {
        if (!error) return;
        const id = show({
            error,
            operation: optionsRef.current?.operation,
            onRetry: optionsRef.current?.onRetry,
        });
        return () => dismiss(id);
    }, [error, show, dismiss]);
}
