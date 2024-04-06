import type { WalletStatusReturnType } from "@frak-labs/nexus-sdk/core";
import { atom } from "jotai/index";

/**
 * Atom representing the current wallet listener
 */
export const walletListenerEmitterAtom = atom<{
    emitter: (response: WalletStatusReturnType) => Promise<void>;
} | null>(null);
