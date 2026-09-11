import { isMobile } from "@frak-labs/core-sdk";

export function useIsMobile() {
    return { isMobile: isMobile() };
}
