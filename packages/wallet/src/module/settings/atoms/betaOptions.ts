import { atom } from "jotai/index";
import { atomWithStorage } from "jotai/utils";

type BetaOptions = { walletConnect: boolean };

/**
 * Atom to enable or disable certain features that are in beta
 */
const betaOptionsAtom = atomWithStorage<BetaOptions>("betaOptions", {
    walletConnect: false,
});

/**
 * Method used to toggle the wallet connect options
 */
export const isWalletConnectEnableAtom = atom(
    (get) => get(betaOptionsAtom).walletConnect,
    (get, set) => {
        const options = get(betaOptionsAtom);
        set(betaOptionsAtom, {
            ...options,
            walletConnect: !options.walletConnect,
        });
    }
);
