import { createContext, type RefObject, useContext } from "react";

type ScrollContextValue = {
    scrollContainerRef: RefObject<HTMLElement | null>;
};

export const AppShellScrollContext = createContext<ScrollContextValue | null>(
    null
);

export function useAppShellScroll(): RefObject<HTMLElement | null> {
    const ctx = useContext(AppShellScrollContext);
    if (!ctx) {
        throw new Error("useAppShellScroll must be used inside <AppShell>");
    }
    return ctx.scrollContainerRef;
}
