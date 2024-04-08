import { atomWithStorage } from "jotai/utils";

/**
 * Atom with our last authenticator
 */
export const postAuthRedirectAtom = atomWithStorage<string | null>(
    "redirectUrl",
    null
);
