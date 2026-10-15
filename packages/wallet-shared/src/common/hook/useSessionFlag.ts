import { useCallback, useSyncExternalStore } from "react";

/**
 * Global subscribers map to track all components using each sessionStorage key
 * This enables same-window synchronization (storage events don't fire in same window)
 */
const subscribers = new Map<string, Set<() => void>>();

/** Stands in for `sessionStorage` when the browser denies it (third-party iframe, Incognito). */
const deniedStorageFlags = new Map<string, string>();

function readFlag(key: string): string | null {
    try {
        return sessionStorage.getItem(key);
    } catch {
        return deniedStorageFlags.get(key) ?? null;
    }
}

function writeFlag(key: string, value: string): void {
    try {
        sessionStorage.setItem(key, value);
    } catch {
        deniedStorageFlags.set(key, value);
    }
}

/**
 * Simple hook to manage a boolean flag in sessionStorage
 * Automatically syncs across all components using the same key (same window and cross-window)
 */
export function useSessionFlag(key: string, defaultValue = false) {
    // Subscribe to changes for this specific key
    const subscribe = useCallback(
        (callback: () => void) => {
            // Add to internal subscribers for same-window sync
            if (!subscribers.has(key)) {
                subscribers.set(key, new Set());
            }
            subscribers.get(key)?.add(callback);

            // Also listen to storage events from other windows/tabs
            const handler = (e: StorageEvent) => {
                if (e.key === key && e.storageArea === sessionStorage) {
                    callback();
                }
            };
            window.addEventListener("storage", handler);

            return () => {
                subscribers.get(key)?.delete(callback);
                if (subscribers.get(key)?.size === 0) {
                    subscribers.delete(key);
                }
                window.removeEventListener("storage", handler);
            };
        },
        [key]
    );

    // Get current value from sessionStorage
    const getSnapshot = useCallback(() => {
        if (typeof window === "undefined") return defaultValue;
        return readFlag(key) === "true";
    }, [key, defaultValue]);

    const value = useSyncExternalStore(
        subscribe,
        getSnapshot,
        () => defaultValue
    );

    // Set value in sessionStorage and notify all subscribers
    const setValue = useCallback(
        (newValue: boolean) => {
            writeFlag(key, String(newValue));

            // Notify all subscribers in current window (useSyncExternalStore requires this)
            subscribers.get(key)?.forEach((callback) => {
                callback();
            });
        },
        [key]
    );

    return [value, setValue] as const;
}
