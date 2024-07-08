import type { IFrameRpcSchema, RpcResponse } from "@frak-labs/nexus-sdk/core";
import { atom } from "jotai/index";

/**
 * Atom representing the current wallet listener
 */
export const walletListenerEmitterAtom = atom<{
    emitter: (
        response: RpcResponse<IFrameRpcSchema, "frak_listenToWalletStatus">
    ) => Promise<void>;
} | null>(null);
