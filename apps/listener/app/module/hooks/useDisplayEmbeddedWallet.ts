import type { IFrameRpcSchema } from "@frak-labs/core-sdk";
import type { RpcPromiseHandler } from "@frak-labs/frame-connector";
import type { WalletRpcContext } from "@/module/types/context";
import { uiBus } from "@/uiBus";
import { ensureUiRuntime } from "@/uiRuntime";

type OnDisplayEmbeddedWalletRequest = RpcPromiseHandler<
    IFrameRpcSchema,
    "frak_displayEmbeddedWallet",
    WalletRpcContext
>;

/**
 * Vanilla factory for the `frak_displayEmbeddedWallet` handler. Triggers
 * Ring 1 mount alongside the impl import; the impl module hosts the
 * deferred wiring + session subscription that resolve on user login.
 */
export function createDisplayEmbeddedWalletHandler(): OnDisplayEmbeddedWalletRequest {
    return async (params, _context) => {
        void ensureUiRuntime();
        const { handleDisplayEmbeddedWallet } = await import(
            "@/module/embedded/component/Wallet"
        );
        return handleDisplayEmbeddedWallet(params, {
            setRequest: uiBus.request,
        });
    };
}
