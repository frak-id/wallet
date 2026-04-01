import { getBackendUrl } from "../utils/backendUrl";
import { getClientId } from "../utils/clientId";
import { sdkConfigStore } from "../utils/sdkConfigStore";

const ENSURE_STORAGE_PREFIX = "frak-identity-ensured-";

/**
 * Ensure the current wallet ↔ clientId link exists on the backend.
 *
 * Called automatically by {@link watchWalletStatus} when a connected wallet
 * status is received. Acts as a failsafe: if the primary merge (SSO, pairing,
 * login/register) missed or silently failed, this ensures the link is
 * eventually established.
 *
 * The call is:
 * - **Idempotent** — if already linked, backend returns immediately
 * - **Deduplicated** — only fires once per browser session per merchant
 * - **Fire-and-forget** — errors are logged but never thrown
 *
 * @param interactionToken - The SDK JWT from wallet status (x-wallet-sdk-auth)
 *
 * @example
 * ```ts
 * // Usually called automatically via watchWalletStatus side effect.
 * // Can also be called manually if needed:
 * await ensureIdentity("eyJhbGciOi...");
 * ```
 */
export async function ensureIdentity(interactionToken: string): Promise<void> {
    if (typeof window === "undefined") {
        return;
    }

    const clientId = getClientId();
    if (!clientId) {
        return;
    }

    const merchantId = await sdkConfigStore.resolveMerchantId();
    if (!merchantId) {
        return;
    }

    const storageKey = `${ENSURE_STORAGE_PREFIX}${merchantId}`;
    if (window.sessionStorage.getItem(storageKey)) {
        return;
    }

    try {
        const backendUrl = getBackendUrl();
        const response = await fetch(`${backendUrl}/user/identity/ensure`, {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                "x-wallet-sdk-auth": interactionToken,
                "x-frak-client-id": clientId,
            },
            body: JSON.stringify({ merchantId }),
        });

        if (response.ok) {
            window.sessionStorage.setItem(storageKey, "1");
        }
    } catch {
        // Fire-and-forget — retry on next session
    }
}
