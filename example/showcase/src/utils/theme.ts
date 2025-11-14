import { useEffect, useState } from "react";

const THEME_STORAGE_KEY = "frak-example-theme";

export type Theme = "light" | "dark";

export function getStoredTheme(): Theme | null {
    try {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        if (stored === "light" || stored === "dark") {
            return stored;
        }
        return null;
    } catch {
        return null;
    }
}

export function setStoredTheme(theme: Theme): void {
    try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
        // Silently fail if localStorage is not available
    }
}

export function getSystemTheme(): Theme {
    if (
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
        return "dark";
    }
    return "light";
}

export function getInitialTheme(): Theme {
    const stored = getStoredTheme();
    if (stored) {
        return stored;
    }
    return getSystemTheme();
}

export function applyTheme(theme: Theme): void {
    if (theme === "dark") {
        document.documentElement.classList.add("dark");
    } else {
        document.documentElement.classList.remove("dark");
    }
}

export function getCurrentTheme(): Theme {
    if (typeof document === "undefined") {
        return "light";
    }
    return document.documentElement.classList.contains("dark")
        ? "dark"
        : "light";
}

export function useTheme(): Theme {
    const [theme, setTheme] = useState<Theme>(getCurrentTheme);

    useEffect(() => {
        // Set initial theme
        const initialTheme = getInitialTheme();
        applyTheme(initialTheme);
        setTheme(initialTheme);

        // Watch for class changes on the document root element
        const observer = new MutationObserver(() => {
            setTheme(getCurrentTheme());
        });

        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["class"],
        });

        return () => observer.disconnect();
    }, []);

    return theme;
}
