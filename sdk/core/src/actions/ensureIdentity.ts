import { getClientIdAsync } from "../config/clientId";
import { getBackendUrl } from "../config/environment";
import { sdkConfigStore } from "../config/sdkConfigStore";
import { signProof } from "../identity/sign";
import { sdkVersionHeaders } from "../utils/sdkVersionHeader";

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
 * - **Deduplicated** — fires once per browser session per (merchant, clientId)
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

    // Awaited rather than read synchronously: this is a failsafe that must
    // work even when it runs before derivation has completed.
    const clientId = await getClientIdAsync().catch(() => undefined);
    if (!clientId) {
        return;
    }

    const merchantId = await sdkConfigStore.resolveMerchantId();
    if (!merchantId) {
        return;
    }

    // Not keyed on the wallet: once a clientId is merged, a later wallet is
    // either already in the group or refused with WALLET_CONFLICT.
    const storageKey = `${ENSURE_STORAGE_PREFIX}${merchantId}-${clientId}`;
    if (window.sessionStorage.getItem(storageKey)) {
        return;
    }

    try {
        const backendUrl = getBackendUrl();
        // Proof is always optional: if it can't be produced (legacy id,
        // keygen failed), the call goes out as before. Off the critical
        // path — a single sign is <1 ms and never blocks or throws.
        const proof = await signProof({
            op: "frak-ensure-v1",
            merchantId,
            anonymousId: clientId,
        });
        const response = await fetch(`${backendUrl}/user/identity/ensure`, {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                "x-wallet-sdk-auth": interactionToken,
                "x-frak-client-id": clientId,
                ...sdkVersionHeaders(),
            },
            body: JSON.stringify({
                merchantId,
                ...(proof && { proof }),
            }),
        });

        if (response.ok) {
            window.sessionStorage.setItem(storageKey, "1");
        }
    } catch {
        // Fire-and-forget — retry on next session
    }
}
