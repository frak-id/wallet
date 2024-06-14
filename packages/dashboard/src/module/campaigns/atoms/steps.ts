import { atom } from "jotai";

/**
 * Atom to keep track of the current campaign step
 */
export const campaignStepAtom = atom<number>(1);

/**
 * Atom that returns true if the campaign was successfully published
 */
export const campaignSuccessAtom = atom<boolean>(false);
