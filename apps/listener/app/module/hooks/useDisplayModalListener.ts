import type { IFrameRpcSchema } from "@frak-labs/core-sdk";
import type { RpcPromiseHandler } from "@frak-labs/frame-connector";
import type { WalletRpcContext } from "@/module/types/context";
import { uiBus } from "@/uiBus";
import { ensureUiRuntime } from "@/uiRuntime";

type OnDisplayModalRequest = RpcPromiseHandler<
    IFrameRpcSchema,
    "frak_displayModal",
    WalletRpcContext
>;

/**
 * Vanilla factory for the `frak_displayModal` handler. Registered eagerly
 * with the RPC listener. The heavy modal-step prep, deferred wiring,
 * analytics and store reads live in `useDisplayModalListener.impl.ts` and
 * are dynamic-imported on first call. The Preact UI runtime is also
 * mounted lazily (in parallel with the impl import) — iframes that never
 * trigger a modal pay zero React/Preact cost on boot.
 */
export function createDisplayModalHandler(): OnDisplayModalRequest {
    return async (params, _context) => {
        // Trigger Ring 1 mount (preact + provider tree) in parallel with
        // the impl import. uiBus.request queues the request until the
        // provider attaches, so we don't need to await the runtime.
        void ensureUiRuntime();
        const { handleDisplayModal } = await import(
            "@/module/modal/component/Modal"
        );
        return handleDisplayModal(params, { setRequest: uiBus.request });
    };
}
