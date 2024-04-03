import { atom, useSetAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { useCallback, useEffect } from "react";

const queryDark = "(prefers-color-scheme: dark)";
const isClient = typeof window !== "undefined";
const watchSystemTheme = isClient ? window.matchMedia(queryDark) : undefined;

type Theme = "light" | "dark" | "auto";

/**
 * Atom to store the system theme
 */
const systemThemeAtom = atom<Omit<Theme, "auto">>(
    watchSystemTheme?.matches ? "dark" : "light"
);

/**
 * Atom to store the user base theme
 */
const userBaseThemeAtom = atomWithStorage<Theme>("theme", "auto");

/**
 * Atom to manipulate the base user theme and update the root element
 */
export const userThemeAtom = atom(
    (get) => get(userBaseThemeAtom),
    (_get, set, theme: Theme) => {
        set(userBaseThemeAtom, theme);
        const root = isClient
            ? (document.querySelector(":root") as HTMLElement)
            : undefined;
        if (!root) return;
        root.dataset.theme = theme;
    }
);

/**
 * Atom to store the current theme
 */
export const currentThemeAtom = atom((get) => {
    const systemTheme = get(systemThemeAtom);
    const userTheme = get(userThemeAtom);
    return userTheme === "auto" ? systemTheme : userTheme;
});

/**
 * Method used to toggle the theme
 */
export const toggleThemeAtom = atom(null, (get, set) =>
    set(userThemeAtom, get(reversedThemeAtom))
);

/**
 * Atom to store the reversed theme
 */
export const reversedThemeAtom = atom((get) =>
    get(currentThemeAtom) === "light" ? "dark" : "light"
);

/**
 * Component to set the theme based on the system theme
 */
export function ThemeListener() {
    const setSystemTheme = useSetAtom(systemThemeAtom);

    const listener = useCallback(
        (event: MediaQueryListEvent) => {
            setSystemTheme(event.matches ? "dark" : "light");
        },
        [setSystemTheme]
    );

    useEffect(() => {
        watchSystemTheme?.addEventListener("change", listener);
        return () => watchSystemTheme?.removeEventListener("change", listener);
    }, [listener]);

    return null;
}
