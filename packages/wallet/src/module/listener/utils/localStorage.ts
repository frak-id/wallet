import { noopStorage } from "@wagmi/core";

/**
 * Get an item from the local storage
 * @param key
 */
export function getFromLocalStorage<T>(key: string) {
    const itemFromLocalStorage = (
        typeof window !== "undefined" ? localStorage : noopStorage
    ).getItem(key);
    if (!itemFromLocalStorage) {
        return;
    }
    return JSON.parse(itemFromLocalStorage) as T;
}
