import { getBackendUrl } from "../config/backendUrl";
import { sdkConfigStore } from "../config/sdkConfigStore";
import { clearPendingLegacyId, signProof } from "../identity/sign";

/**
 * Fold a pre-derivation (legacy) anonymous id into the derived id that
 * replaced it, so the user's history on this merchant survives the switch
 * to a provable identity.
 *
 * Flips the stored id *before* the iframe is created (derivation is purely
 * local, no network) so the listener is seeded with the derived id
 * directly and never observes the legacy one — no mid-session desync.
 * Migration then runs here, off the critical path.
 *
 * Optimistic: the id flips whether or not the merge later succeeds. A
 * failure leaves the legacy id orphaned (still resolvable, just unlinked)
 * until a retry succeeds — the `localStorage` marker drives that retry and
 * is cleared only on confirmed merge or definitive rejection.
 *
 * Never throws, never blocks: any failure is left for the next visit.
 */
export async function migrateLegacyIdentity({
    legacyId,
    derivedId,
    walletUrl,
}: {
    legacyId: string;
    derivedId: string;
    walletUrl?: string;
}): Promise<void> {
    if (typeof window === "undefined") return;
    // A derivation that produced the id it is replacing would merge a group
    // into itself; nothing to do, and the marker is stale.
    if (!legacyId || legacyId === derivedId) {
        clearPendingLegacyId();
        return;
    }

    try {
        const merchantId = await sdkConfigStore.resolveMerchantId();
        if (!merchantId) return;

        // Proves possession of `derivedId` (the merge SOURCE) only —
        // nothing about `legacyId`, since no key ever existed for it. That's
        // accepted: an attacker can run the identical migration against any
        // harvested legacy id. Still required by `/merge/initiate`, so a
        // signing failure aborts rather than sending a request that 403s.
        const proof = await signProof({
            op: "frak-merge-v1",
            merchantId,
            anonymousId: derivedId,
        });
        if (!proof) return;

        const backendUrl = getBackendUrl(walletUrl);

        const initiateResponse = await fetch(
            `${backendUrl}/user/identity/merge/initiate`,
            {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    sourceAnonymousId: derivedId,
                    merchantId,
                    proof,
                }),
            }
        );
        if (!initiateResponse.ok) {
            // 4xx: this migration can never succeed as posed (e.g. the
            // derived id is latched to a different key), so drop the marker
            // rather than loop forever. 5xx/network falls to the catch
            // below and retries.
            if (initiateResponse.status < 500) clearPendingLegacyId();
            return;
        }

        const { mergeToken } = (await initiateResponse.json()) as {
            mergeToken?: string;
        };
        if (!mergeToken) return;

        const executeResponse = await fetch(
            `${backendUrl}/user/identity/merge/execute`,
            {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    mergeToken,
                    targetAnonymousId: legacyId,
                    merchantId,
                }),
            }
        );

        // Cleared only now: the legacy id is folded in. `mergeGroups`
        // repoints the node (never deletes it), so already-published
        // `fCtx` links carrying the legacy id keep resolving.
        if (executeResponse.ok) {
            clearPendingLegacyId();
            return;
        }
        if (executeResponse.status < 500) clearPendingLegacyId();
    } catch {
        // Transient (offline, DNS, 5xx). The marker stays, so the next
        // visit retries.
    }
}
