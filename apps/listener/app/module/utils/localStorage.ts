import { sessionStore } from "@frak-labs/wallet-shared/stores/sessionStore";
import type {
    SdkSession,
    Session,
} from "@frak-labs/wallet-shared/types/Session";

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
 * Get the current session in a safe way (in the case of zustand store not synced)
 */
export function getSafeSession() {
    const storeState = sessionStore.getState().session;
    if (storeState) return storeState;

    // Fallback: try to read from localStorage directly
    const stored = getFromLocalStorage<{ state: { session: Session | null } }>(
        "frak_session_store"
    );
    return stored?.state?.session ?? null;
}

/**
 * Get the current session in a safe way (in the case of zustand store not synced)
 */
export function getSafeSdkSession() {
    const storeState = sessionStore.getState().sdkSession;
    if (storeState) return storeState;

    // Fallback: try to read from localStorage directly
    const stored = getFromLocalStorage<{
        state: { sdkSession: SdkSession | null };
    }>("frak_session_store");
    return stored?.state?.sdkSession ?? null;
}
