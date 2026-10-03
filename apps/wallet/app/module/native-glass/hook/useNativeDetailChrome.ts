import { useMediaQuery } from "@frak-labs/design-system/hooks/useMediaQuery";
import { hasNativeGlass } from "../bridge";

/**
 * Whether a detail sheet swaps its chrome for native glass. From 1024pt (large
 * iPads) the sheet becomes a centred card, which screen-pinned native views
 * would sit outside of.
 */
export function useNativeDetailChrome(): boolean {
    const cardLayout = useMediaQuery("(min-width: 1024px)");
    return hasNativeGlass() && !cardLayout;
}
