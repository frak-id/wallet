import { getBackendUrl } from "../config/environment";
import { sdkConfigStore } from "../config/sdkConfigStore";
import { clearPendingLegacyId, signProof } from "../identity/sign";
import { sdkVersionHeaders } from "../utils/sdkVersionHeader";

/**
 * Error codes naming a credential the caller could hold later. Refusing on
 * one of these says the request was inadmissible, not that the migration is
 * impossible, so the marker survives for a future visit to retry.
 */
const RECOVERABLE_ERROR_CODES = new Set([
    "PROOF_REQUIRED",
    "PROOF_OR_TOKEN_REQUIRED",
    "MISSING_ANONYMOUS_ID",
]);

/**
 * Whether a failed merge response leaves the legacy id worth retrying. A 403
 * is admission control, which a later visit may satisfy; other 4xx are
 * terminal for this pairing and drop the marker rather than loop forever.
 */
async function isRecoverableFailure(response: Response): Promise<boolean> {
    if (response.status >= 500) return true;
    if (response.status === 403) return true;
    try {
        const body = (await response.clone().json()) as { code?: string };
        return (
            typeof body.code === "string" &&
            RECOVERABLE_ERROR_CODES.has(body.code)
        );
    } catch {
        return false;
    }
}

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

        // Proves possession of `derivedId` only (no key ever existed for
        // `legacyId`). Still required by `/merge/initiate`, so a signing
        // failure aborts rather than sending a request that 403s.
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
                    ...sdkVersionHeaders(),
                },
                body: JSON.stringify({
                    sourceAnonymousId: derivedId,
                    merchantId,
                    proof,
                }),
            }
        );
        if (!initiateResponse.ok) {
            if (!(await isRecoverableFailure(initiateResponse))) {
                clearPendingLegacyId();
            }
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
                    ...sdkVersionHeaders(),
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
        if (!(await isRecoverableFailure(executeResponse))) {
            clearPendingLegacyId();
        }
    } catch {
        // Transient (offline, DNS, 5xx). The marker stays, so the next
        // visit retries.
    }
}
