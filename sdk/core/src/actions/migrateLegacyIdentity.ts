import { getBackendUrl } from "../config/backendUrl";
import { sdkConfigStore } from "../config/sdkConfigStore";
import { clearPendingLegacyId, signProof } from "../identity/sign";

/**
 * Fold a pre-derivation (legacy) anonymous id into the derived id that has
 * replaced it, so the user's history on this merchant survives the switch to
 * a provable identity (README §2.6).
 *
 * Ordering, and why it is not the one the README describes:
 *
 * README §2.6 flips the stored id only on the *next* page load, because
 * `getClientId()` is synchronous while the merge is async, and flipping
 * mid-session would desynchronise the SDK from the listener's
 * `clientIdStore` (seeded from the `?clientId=` iframe param at load) and
 * from any share link already rendered.
 *
 * We flip *before* the iframe is created instead. Key generation and
 * derivation are purely local (`localStorage` + WebCrypto, ~1-3 ms, no
 * network); only the merge needs the backend. So the derived id can be
 * minted first and the iframe seeded with it directly — the listener never
 * observes the legacy id, there is nothing to reload, and the desync the
 * README guards against cannot occur. Migration then runs here, off the
 * critical path.
 *
 * This is optimistic: the id flips whether or not the merge later succeeds.
 * A failure leaves the legacy id *orphaned*, not corrupted — it keeps
 * resolving on the backend, it simply is not linked to the new id yet, so
 * the two histories stay split until a retry succeeds. The marker in
 * `localStorage` is what makes that retry happen; it is cleared only on a
 * confirmed merge (or on a definitive rejection that retrying cannot fix).
 *
 * Both calls are additive to the existing merge endpoints rather than a new
 * one — hardening the surface instead of widening it.
 *
 * Never throws, never blocks: any failure is left for the next visit.
 */
export async function migrateLegacyIdentity({
    legacyId,
    derivedId,
}: {
    legacyId: string;
    derivedId: string;
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

        // Proves possession of `derivedId`, the merge SOURCE. It proves
        // nothing about `legacyId` and cannot — no key ever existed for it.
        // README §2.6 ("the migration is itself the attack") establishes
        // that this is unclosable and accepted: an attacker can run the
        // identical, fully-valid migration against any harvested legacy id.
        // Proof on the source side is still required by the backend's
        // `/merge/initiate` arm, so a failure to sign aborts rather than
        // sending a request that would 403.
        const proof = await signProof({
            op: "frak-merge-v1",
            merchantId,
            anonymousId: derivedId,
        });
        if (!proof) return;

        const backendUrl = getBackendUrl();

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
            // 4xx here means this migration will never succeed as posed
            // (e.g. the derived id is latched to a different key, or the
            // proof is rejected outright). Retrying every visit would be a
            // permanent no-op loop, so drop the marker and leave the legacy
            // id resolvable-but-unlinked. 5xx / network errors fall through
            // to the catch below and DO retry.
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

        // Cleared only now: the legacy id is folded in and the marker has
        // done its job. `mergeGroups` repoints the node and deletes the
        // losing group row, never the node itself (README §2.6), so every
        // already-published `fCtx` link carrying the legacy id keeps
        // resolving.
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
