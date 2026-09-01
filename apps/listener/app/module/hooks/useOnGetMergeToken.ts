import type { IFrameRpcSchema } from "@frak-labs/core-sdk";
import type { RpcPromiseHandler } from "@frak-labs/frame-connector";
import { trackEvent } from "@frak-labs/wallet-shared/common/analytics";
import { authenticatedBackendApi } from "@frak-labs/wallet-shared/common/api/backendClient";
import type { WalletRpcContext } from "@/module/types/context";

type OnGetMergeToken = RpcPromiseHandler<
    IFrameRpcSchema,
    "frak_getMergeToken",
    WalletRpcContext
>;

/**
 * RPC handler factory for `frak_getMergeToken`.
 *
 * Returns a merge token that allows the current anonymous identity
 * to be linked when reopening the page in an external browser.
 */
export function createGetMergeTokenHandler(): OnGetMergeToken {
    return async (params, context) => {
        const { merchantId, clientId, mergeSourceProof } = context;
        if (!clientId || !merchantId) return null;

        // `params[0]` carries the SDK's frak-merge-v1 proof. An SDK too old to
        // send it may still have pushed one on `resolved-config`, so fall back
        // to the stored empty-binding proof before counting this as proofless.
        const proof = params?.[0] || mergeSourceProof;
        if (!proof) {
            // Counted before the return: no request reaches the backend, so
            // this event is the only way to see the refused population.
            trackEvent("merge_initiate_proofless");
            // `getMergeToken` already treats null as "no escape token", so the
            // escape still redirects — it just carries no `?fmt=`.
            return null;
        }
        const { data } =
            await authenticatedBackendApi.user.identity.merge.initiate.post({
                sourceAnonymousId: clientId,
                merchantId,
                proof,
            });
        return data?.mergeToken ?? null;
    };
}
