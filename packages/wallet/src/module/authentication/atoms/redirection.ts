import { atom } from "jotai";

/**
 * Atom with our last authenticator
 */
export const postAuthRedirectAtom = atom<string | null>(null);
