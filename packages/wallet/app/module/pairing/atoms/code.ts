import { atom } from "jotai";

/**
 * Atom to keep track of the current pairing code
 */
export const pendingPairingAtom = atom<{
    id: string;
    code: string;
} | null>(null);
