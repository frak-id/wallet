import type { IFrameRpcSchema } from "@frak-labs/core-sdk";
import type { RpcPromiseHandler } from "@frak-labs/frame-connector";
import { useCallback } from "react";
import { useListenerUI } from "@/module/providers/ListenerUiProvider";
import type { WalletRpcContext } from "@/module/types/context";

type OnDisplayEmbeddedWalletRequest = RpcPromiseHandler<
    IFrameRpcSchema,
    "frak_displayEmbeddedWallet",
    WalletRpcContext
>;

/**
 * Thin shell registered eagerly with the RPC listener. The deferred
 * wiring, store subscription and analytics live in
 * `useDisplayEmbeddedWallet.impl.ts` and are dynamically imported the
 * first time `frak_displayEmbeddedWallet` is invoked.
 */
export function useDisplayEmbeddedWallet(): OnDisplayEmbeddedWalletRequest {
    const { setRequest } = useListenerUI();

    return useCallback(
        async (params, _context) => {
            const { handleDisplayEmbeddedWallet } = await import(
                "./useDisplayEmbeddedWallet.impl"
            );
            return handleDisplayEmbeddedWallet(params, { setRequest });
        },
        [setRequest]
    );
}
