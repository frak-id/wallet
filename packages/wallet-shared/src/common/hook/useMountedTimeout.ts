import { useCallback, useEffect, useRef } from "react";

/**
 * Timeout management with mounted-safety. Auto-cancels on unmount,
 * skips callbacks if unmounted. Shared by mobile pairing + tx flows.
 */
export function useMountedTimeout() {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        };
    }, []);

    const startTimeout = useCallback(
        (callback: () => void, delayMs: number) => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            timeoutRef.current = setTimeout(() => {
                if (!mountedRef.current) return;
                callback();
            }, delayMs);
        },
        []
    );

    const clearCurrentTimeout = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    return {
        startTimeout,
        clearTimeout: clearCurrentTimeout,
    };
}
