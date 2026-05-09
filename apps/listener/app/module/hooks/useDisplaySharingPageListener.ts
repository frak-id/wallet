import type { IFrameRpcSchema } from "@frak-labs/core-sdk";
import type { RpcPromiseHandler } from "@frak-labs/frame-connector";
import { uiBus } from "@/uiBus";
import { ensureUiRuntime } from "@/uiRuntime";
import type { WalletRpcContext } from "@/module/types/context";

type OnDisplaySharingPageRequest = RpcPromiseHandler<
    IFrameRpcSchema,
    "frak_displaySharingPage",
    WalletRpcContext
>;

/**
 * Vanilla factory for the `frak_displaySharingPage` handler. The sharing
 * page resolves on the first user action (share/copy) but stays visible.
 * Dismissing after a share/copy is a no-op (promise already resolved).
 */
export function createDisplaySharingPageHandler(): OnDisplaySharingPageRequest {
    return async (params, _context) => {
        void ensureUiRuntime();
        const { handleDisplaySharingPage } = await import(
            "./useDisplaySharingPageListener.impl"
        );
        return handleDisplaySharingPage(params, {
            setRequest: uiBus.request,
        });
    };
}
