import { desktop, tablet } from "../breakpoints";
import { useMediaQuery } from "./useMediaQuery";

type ResponsiveValues<T> = {
    mobile?: T;
    tablet?: T;
    desktop?: T;
};

/**
 * Resolve a single value for the current breakpoint using the DS's three
 * breakpoints (`mobile` / `tablet` @ 768 / `desktop` @ 1024), authored
 * mobile-first with carry-forward: an undefined breakpoint falls back to the
 * next-smaller defined one (desktop → tablet → mobile).
 *
 * Use for *runtime* branching (which element/component to render). For pure
 * styling, prefer sprinkles responsive conditions (CSS `@media`).
 *
 * SSR-safe: `useMediaQuery` reports `false` on the server, so the initial
 * render resolves to the `mobile` value.
 */
export function useResponsiveValue<T>(
    values: ResponsiveValues<T>
): T | undefined {
    const isTablet = useMediaQuery(`(min-width: ${tablet}px)`);
    const isDesktop = useMediaQuery(`(min-width: ${desktop}px)`);

    if (isDesktop) {
        return values.desktop ?? values.tablet ?? values.mobile;
    }
    if (isTablet) {
        return values.tablet ?? values.mobile;
    }
    return values.mobile;
}
