import { jotaiStore } from "@frak-labs/ui/atoms/store";
import { sdkSessionAtom, sessionAtom } from "@frak-labs/wallet-shared/common/atoms/session";
import type { SdkSession, Session } from "@frak-labs/wallet-shared/types/Session";

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
