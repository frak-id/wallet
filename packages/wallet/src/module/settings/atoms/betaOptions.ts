import { atom } from "jotai/index";
import { atomWithStorage } from "jotai/utils";

type BetaOptions = { convertToEuro: boolean };

/**
 * Atom to enable or disable certain features that are in beta
 */
const betaOptionsAtom = atomWithStorage<BetaOptions>("betaOptions", {
    convertToEuro: true,
});

/**
 * Method used to toggle the convert to euro options
 */
export const isConvertToEuroEnableAtom = atom(
    (get) => get(betaOptionsAtom).convertToEuro ?? true,
    (get, set) => {
        const options = get(betaOptionsAtom);
        set(betaOptionsAtom, {
            ...options,
            convertToEuro: !(options.convertToEuro ?? true),
        });
    }
);
