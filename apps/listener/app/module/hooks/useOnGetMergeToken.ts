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
    return async (_params, context) => {
        const { merchantId, clientId } = context;
        if (!clientId || !merchantId) return null;

        const { data } =
            await authenticatedBackendApi.user.identity.merge.initiate.post({
                sourceAnonymousId: clientId,
                merchantId,
            });
        return data?.mergeToken ?? null;
    };
}
