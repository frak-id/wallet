import { jotaiStore } from "@frak-labs/ui/atoms/store";
import type { SdkSession, Session } from "../../types/Session";
import { sdkSessionAtom, sessionAtom } from "../atoms/session";

/**
 * Get an item from the local storage
 * @param key
 */
export function getFromLocalStorage<T>(key: string) {
    if (typeof window === "undefined") {
        return undefined;
    }
    const itemFromLocalStorage = localStorage.getItem(key);
    if (!itemFromLocalStorage) {
        return;
    }
    return JSON.parse(itemFromLocalStorage) as T;
}

/**
 * Get the current session in a safe way (in the case of jotai store not synced)
 */
export function getSafeSession() {
    return (
        jotaiStore.get(sessionAtom) ??
        getFromLocalStorage<Session>("frak_session")
    );
}

/**
 * Get the current session in a safe way (in the case of jotai store not synced)
 */
export function getSafeSdkSession() {
    return (
        jotaiStore.get(sdkSessionAtom) ??
        getFromLocalStorage<SdkSession>("frak_sdkSession")
    );
}
