import { getClientIdAsync } from "../config/clientId";
import { signProof } from "../identity/sign";
import type { FrakClient } from "../types";
import { withCache } from "../utils/cache";

/**
 * Fetch a merge token for the current anonymous identity.
 *
 * Used by in-app browser redirect flows to preserve identity
 * when switching from a WebView to the system browser.
 * The token is appended as `?fmt=` to the redirect URL.
 *
 * Results are cached in memory for 30 seconds by default. Concurrent calls
 * while a request is in-flight are deduplicated automatically.
 *
 * @param client - The current Frak Client
 * @param options - Optional cache configuration
 * @param options.cacheTime - Time in ms to cache the result. Default: 30_000 (30s). Set to 0 to disable.
 * @returns The merge token string, or null if unavailable
 */
export async function getMergeToken(
    client: FrakClient,
    options?: { cacheTime?: number }
): Promise<string | null> {
    return withCache(
        async () => {
            // README §4.2: this proof binds `sourceAnonymousId` only — no
            // merge token exists yet at `initiate` time, so the binding is
            // empty, unlike the `execute`-side `frak-merge-v1` proof (§4.3),
            // which binds SHA-256(mergeToken). Always optional: if it can't
            // be produced (legacy id, keygen failed), the call goes out
            // exactly as it does today. Signing lives inside this closure
            // so a cache hit performs no crypto — `withCache` only invokes
            // it on a miss (or to join an in-flight call).
            const anonymousId = await getClientIdAsync().catch(() => undefined);
            const proof = anonymousId
                ? await signProof({
                      op: "frak-merge-v1",
                      merchantId: client.config.metadata.merchantId ?? "",
                      anonymousId,
                  })
                : null;

            return client.request({
                method: "frak_getMergeToken",
                params: proof ? [proof] : undefined,
            });
        },
        {
            cacheKey: "frak_getMergeToken",
            cacheTime: options?.cacheTime,
        }
    );
}
