import { useCallback, useEffect, useRef } from "react";

/** Runs `onReturn` once, the next time the page becomes visible after `arm()`: the user is back from another app. */
export function useOnReturn(onReturn: () => void) {
    const armed = useRef(false);
    const latest = useRef(onReturn);
    latest.current = onReturn;

    useEffect(() => {
        const onVisibilityChange = () => {
            if (document.visibilityState !== "visible" || !armed.current) {
                return;
            }
            armed.current = false;
            latest.current();
        };
        document.addEventListener("visibilitychange", onVisibilityChange);
        return () =>
            document.removeEventListener(
                "visibilitychange",
                onVisibilityChange
            );
    }, []);

    return useCallback(() => {
        armed.current = true;
    }, []);
}
