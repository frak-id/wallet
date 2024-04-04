"use client";

import { atom, useAtomValue, useSetAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { useCallback, useEffect } from "react";

const isClientAtom = atom(() => typeof window !== "undefined");

type SystemTheme = "light" | "dark";
type Theme = SystemTheme | "auto";

/**
 * Atom to store the system theme
 */
const systemThemeAtom = atom<SystemTheme>("light");

/**
 * Atom to store the user base theme
 */
const storageThemeAtom = atomWithStorage<Theme>("theme", "auto");

/**
 * Atom to manipulate the base user theme and update the root element
 */
export const userThemeAtom = atom(
    (get) => {
        const userTheme = get(storageThemeAtom);
        if (userTheme === "auto") {
            return get(systemThemeAtom);
        }
        return userTheme;
    },
    (get, set, theme: Theme) => {
        // Set the theme in storage
        set(storageThemeAtom, theme);

        // Update the root theme
        const root = get(isClientAtom)
            ? (document.querySelector(":root") as HTMLElement)
            : undefined;
        if (!root) return;
        root.dataset.theme = theme;
    }
);

/**
 * Atom to get the reversed theme
 */
export const reversedThemeAtom = atom((get) =>
    get(userThemeAtom) === "light" ? "dark" : "light"
);

/**
 * Method used to toggle the theme
 */
export const toggleThemeAtom = atom(null, (get, set) =>
    set(userThemeAtom, get(reversedThemeAtom))
);

/**
 * Component to set the theme based on the system theme
 */
export function ThemeListener() {
    const isClient = useAtomValue(isClientAtom);

    // Theme setter
    const setSystemTheme = useSetAtom(systemThemeAtom);

    /**
     * The system theme listener
     */
    const listener = useCallback(
        (event: MediaQueryListEvent | MediaQueryList) => {
            setSystemTheme(event.matches ? "dark" : "light");
        },
        [setSystemTheme]
    );

    /**+
     * Setup the system theme listener
     */
    useEffect(() => {
        // Early return if not on the client
        if (!isClient) return;

        const watchSystemTheme = window.matchMedia(
            "(prefers-color-scheme: dark)"
        );

        // Set initial state
        listener(watchSystemTheme);

        // Setup listener
        watchSystemTheme.addEventListener("change", listener);

        // Remove listener
        return () => watchSystemTheme.removeEventListener("change", listener);
    }, [isClient, listener]);

    return null;
}
