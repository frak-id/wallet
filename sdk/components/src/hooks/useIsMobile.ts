import { isMobile } from "@frak-labs/core-sdk";
import { useMemo } from "preact/hooks";

export function useIsMobile() {
    const isMobileDevice = useMemo(() => isMobile(), []);
    return { isMobile: isMobileDevice };
}
