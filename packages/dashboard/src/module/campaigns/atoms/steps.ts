import { atomWithStorage } from "jotai/utils";

/**
 * Atom to keep track of the current campaign step
 */
export const campaignStepAtom = atomWithStorage<number>("campaignStep", 1);

/**
 * Atom that returns true if the campaign was successfully published
 */
export const campaignSuccessAtom = atomWithStorage<boolean>(
    "campaignSuccess",
    false
);

/**
 * Atom used when user is closing the campaign by clicking on the close button
 */
export const campaignIsClosingAtom = atomWithStorage<boolean>(
    "campaignIsClosing",
    false
);
