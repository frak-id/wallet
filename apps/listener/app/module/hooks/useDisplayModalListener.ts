import type { IFrameRpcSchema } from "@frak-labs/core-sdk";
import type { RpcPromiseHandler } from "@frak-labs/frame-connector";
import { useCallback } from "react";
import { useListenerUI } from "@/module/providers/ListenerUiProvider";
import type { WalletRpcContext } from "@/module/types/context";

type OnDisplayModalRequest = RpcPromiseHandler<
    IFrameRpcSchema,
    "frak_displayModal",
    WalletRpcContext
>;

/**
 * Thin shell registered eagerly with the RPC listener. The heavy logic
 * (modal-step prep, deferred wiring, analytics, store reads) lives in
 * `useDisplayModalListener.impl.ts` and is dynamically imported the first
 * time a `frak_displayModal` RPC actually arrives. Iframes that never
 * trigger a modal pay zero cost for that code on boot.
 */
export function useDisplayModalListener(): OnDisplayModalRequest {
    const { setRequest } = useListenerUI();

    return useCallback(
        async (params, _context) => {
            const { handleDisplayModal } = await import(
                "./useDisplayModalListener.impl"
            );
            return handleDisplayModal(params, { setRequest });
        },
        [setRequest]
    );
}
