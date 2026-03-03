import { isTauri } from "@frak-labs/app-essentials/utils/platform";
import { useCallback, useRef } from "react";

const TAP_THRESHOLD = 5;
const TAP_TIMEOUT_MS = 2000;

/**
 * Hidden demo access: tap 5 times within 2s to navigate to demo registration.
 * Only enabled in Tauri (native app) for app store reviewers.
 */
export function useDemoTap(
    navigate: (opts: { to: string }) => void,
    to = "/register-demo"
) {
    const enabled = isTauri();
    const tapCountRef = useRef(0);
    const tapTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    const onTap = useCallback(() => {
        if (!enabled) return;
        tapCountRef.current += 1;
        clearTimeout(tapTimerRef.current);
        if (tapCountRef.current >= TAP_THRESHOLD) {
            tapCountRef.current = 0;
            navigate({ to });
            return;
        }
        tapTimerRef.current = setTimeout(() => {
            tapCountRef.current = 0;
        }, TAP_TIMEOUT_MS);
    }, [navigate, enabled, to]);

    return { onTap, enabled };
}
