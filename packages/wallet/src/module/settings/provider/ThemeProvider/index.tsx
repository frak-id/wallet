"use client";

import { useLocalStorage } from "@uidotdev/usehooks";

const queryDark = "(prefers-color-scheme: dark)";
const watchSystemTheme = window.matchMedia(queryDark);

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
} from "react";
import type { ReactNode } from "react";
import { useMemo } from "react";

function useThemeHook() {
    const [theme, setTheme] = useLocalStorage<"light" | "dark" | null>(
        "theme",
        null
    );
    const [themeSystem, setThemeSystem] = useState<"light" | "dark">(
        watchSystemTheme.matches ? "dark" : "light"
    );
    const currentTheme = theme ?? themeSystem;
    const reversedTheme = currentTheme === "light" ? "dark" : "light";

    const toggleTheme = useCallback(() => {
        setTheme(reversedTheme);
    }, [setTheme, reversedTheme]);

    function useSetTheme(event: MediaQueryListEvent) {
        setThemeSystem(event.matches ? "dark" : "light");
    }

    useEffect(() => {
        const root = document.querySelector(":root") as HTMLElement;
        root.dataset.theme = theme ?? themeSystem;

        watchSystemTheme.addEventListener("change", useSetTheme);

        return () => {
            watchSystemTheme.removeEventListener("change", useSetTheme);
        };
    }, [theme, themeSystem]);

    return useMemo(
        () => ({
            theme: currentTheme,
            toggleTheme,
            reversedTheme,
        }),
        [currentTheme, toggleTheme, reversedTheme]
    );
}

type UseThemeHook = ReturnType<typeof useThemeHook>;
const ThemeContext = createContext<UseThemeHook | null>(null);

export const useTheme = (): UseThemeHook => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error("useTheme hook must be used within a ThemeProvider");
    }
    return context;
};

export function ThemeProvider({ children }: { children: ReactNode }) {
    const hook = useThemeHook();

    return (
        <ThemeContext.Provider value={hook}>{children}</ThemeContext.Provider>
    );
}
