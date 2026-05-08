import type { IFrameRpcSchema } from "@frak-labs/core-sdk";
import type { RpcPromiseHandler } from "@frak-labs/frame-connector";
import { useCallback } from "react";
import { useListenerUI } from "@/module/providers/ListenerUiProvider";
import type { WalletRpcContext } from "@/module/types/context";

type OnDisplaySharingPageRequest = RpcPromiseHandler<
    IFrameRpcSchema,
    "frak_displaySharingPage",
    WalletRpcContext
>;

/**
 * Thin shell registered eagerly with the RPC listener. The deferred
 * wiring, store reads and analytics live in
 * `useDisplaySharingPageListener.impl.ts` and are dynamically imported
 * the first time `frak_displaySharingPage` is invoked.
 *
 * The sharing page resolves on the first user action (share/copy) but
 * stays visible. Dismissing after a share/copy is a no-op (promise
 * already resolved).
 */
export function useDisplaySharingPageListener(): OnDisplaySharingPageRequest {
    const { setRequest } = useListenerUI();

    return useCallback(
        async (params, _context) => {
            const { handleDisplaySharingPage } = await import(
                "./useDisplaySharingPageListener.impl"
            );
            return handleDisplaySharingPage(params, { setRequest });
        },
        [setRequest]
    );
}
