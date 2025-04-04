import { atom } from "jotai";

/**
 * Atom to keep track of the current pairing code
 */
export const pairingCodeAtom = atom<string | null>(null);
