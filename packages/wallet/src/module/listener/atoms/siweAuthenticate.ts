import type { AuthenticateReturnType } from "@frak-labs/nexus-sdk/core";
import { atom } from "jotai/index";
import type { SiweMessage } from "viem/siwe";

/**
 * Atom representing the current wallet listener
 */
export const siweAuthenticateAtom = atom<{
    siweMessage: SiweMessage;
    context?: string;
    emitter: (response: AuthenticateReturnType) => Promise<void>;
} | null>(null);
