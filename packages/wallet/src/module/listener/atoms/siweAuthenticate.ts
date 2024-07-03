import type {
    SiweAuthenticateReturnType,
    SiweAuthenticationParams,
} from "@frak-labs/nexus-sdk/core";
import { atom } from "jotai/index";

/**
 * Atom representing the current wallet listener
 */
export const siweAuthenticateAtom = atom<{
    siweMessage: SiweAuthenticationParams;
    context?: string;
    emitter: (response: SiweAuthenticateReturnType) => Promise<void>;
} | null>(null);
