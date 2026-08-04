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
            // This proof binds only merchantId/anonymousId — no merge token
            // exists yet, so the binding is empty (unlike the execute-side
            // proof, which binds SHA-256(mergeToken)). Optional: if it can't
            // be produced, the call goes out as before. Signing lives inside
            // this closure so a cache hit performs no crypto.
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
