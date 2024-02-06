import { useCallback, useEffect, useSyncExternalStore } from "react";

function dispatchStorageEvent(key: string, newValue: string | null) {
    window.dispatchEvent(new StorageEvent("storage", { key, newValue }));
}

function getLocalStorageItem(key: string) {
    return window.localStorage.getItem(key);
}

function setLocalStorageItem(key: string, value: unknown) {
    const stringifiedValue = JSON.stringify(value);
    window.localStorage.setItem(key, stringifiedValue);
    dispatchStorageEvent(key, stringifiedValue);
}

function removeLocalStorageItem(key: string) {
    window.localStorage.removeItem(key);
    dispatchStorageEvent(key, null);
}

function useLocalStorageSubscribe(
    callback: (this: Window, ev: StorageEvent) => unknown
) {
    window.addEventListener("storage", callback);
    return () => window.removeEventListener("storage", callback);
}

/**
 * From https://github.com/uidotdev/usehooks
 * Need to reimport since it uses fcked up react import
 */
export function useLocalStorage<T>(
    key: string,
    initialValue: T
): [T, (valueUpdater: (oldValue: T) => T) => void] {
    const getSnapshot = () => getLocalStorageItem(key);

    const store = useSyncExternalStore(
        useLocalStorageSubscribe,
        getSnapshot,
        () => {
            throw new Error("useLocalStorage: client hook only");
        }
    );

    const setState = useCallback(
        (valueUpdater: (oldValue: T) => T) => {
            try {
                const nextState = valueUpdater(JSON.parse(store ?? "null"));

                if (nextState === undefined || nextState === null) {
                    removeLocalStorageItem(key);
                } else {
                    setLocalStorageItem(key, nextState);
                }
            } catch (e) {
                console.warn(e);
            }
        },
        [key, store]
    );

    useEffect(() => {
        if (
            getLocalStorageItem(key) === null &&
            typeof initialValue !== "undefined"
        ) {
            setLocalStorageItem(key, initialValue);
        }
    }, [key, initialValue]);

    return [store ? JSON.parse(store) : initialValue, setState];
}
