// Reading these throws when third-party storage is blocked (Incognito, cookie settings); undefined means no storage.
export function sessionStorageIfAllowed(): Storage | undefined {
    try {
        return globalThis.sessionStorage;
    } catch {
        return undefined;
    }
}

export function localStorageIfAllowed(): Storage | undefined {
    try {
        return globalThis.localStorage;
    } catch {
        return undefined;
    }
}
