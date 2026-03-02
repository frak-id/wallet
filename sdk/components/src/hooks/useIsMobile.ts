import { useMemo } from "preact/hooks";
import { isMobile } from "@/utils/isMobile";

export function useIsMobile() {
    const isMobileDevice = useMemo(() => isMobile(), []);
    return { isMobile: isMobileDevice };
}
