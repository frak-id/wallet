import type { IFrameRpcSchema } from "@frak-labs/core-sdk";
import type { RpcPromiseHandler } from "@frak-labs/frame-connector";
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
        const { merchantId, clientId } = context;
        if (!clientId || !merchantId) return null;

        // `params[0]` carries the SDK's frak-merge-v1 proof (README §4.2).
        // Old SDKs send no params at all, so this is `undefined` for them —
        // forwarded as `proof: undefined`, which the JSON body serialiser
        // drops, leaving the request byte-identical to before.
        const proof = params?.[0];
        const { data } =
            await authenticatedBackendApi.user.identity.merge.initiate.post({
                sourceAnonymousId: clientId,
                merchantId,
                proof,
            });
        return data?.mergeToken ?? null;
    };
}
