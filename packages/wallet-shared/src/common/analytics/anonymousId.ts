import { clientIdStore } from "../../stores/clientIdStore";

const INSTALL_ID_STORAGE_KEY = "frak_analytics_install_id";

let cachedInstallId: string | undefined;
let hostAnonymousId: string | undefined;

/**
 * Per-install anonymous id, persisted in `localStorage`. Falls back to an
 * in-memory id for the page lifetime when storage is blocked or throws.
 */
export function getInstallId(): string {
    if (cachedInstallId) return cachedInstallId;
    try {
        cachedInstallId =
            window.localStorage.getItem(INSTALL_ID_STORAGE_KEY) || undefined;
        if (!cachedInstallId) {
            cachedInstallId = crypto.randomUUID();
            window.localStorage.setItem(
                INSTALL_ID_STORAGE_KEY,
                cachedInstallId
            );
        }
    } catch {
        cachedInstallId ??= crypto.randomUUID();
    }
    return cachedInstallId;
}

/** Id handed over by the host that opened this surface (URL param, RPC). */
export function rememberHostAnonymousId(id?: string | null) {
    if (id) hostAnonymousId = id;
}

/** Host id, then the SDK-seeded `clientIdStore` id, then the install id. */
export function resolveAnonymousId(): string {
    return (
        hostAnonymousId || clientIdStore.getState().clientId || getInstallId()
    );
}
