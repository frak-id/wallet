import { atom } from "jotai/index";
import { atomWithStorage } from "jotai/utils";

type BetaOptions = { walletConnect: boolean; mainnet: boolean };

/**
 * Atom to enable or disable certain features that are in beta
 */
const betaOptionsAtom = atomWithStorage<BetaOptions>("betaOptions", {
    walletConnect: false,
    mainnet: false,
});

/**
 * Method used to toggle the wallet connect options
 */
export const isWalletConnectEnableAtom = atom(
    (get) => get(betaOptionsAtom).walletConnect ?? false,
    (get, set) => {
        const options = get(betaOptionsAtom);
        set(betaOptionsAtom, {
            ...options,
            walletConnect: !(options.walletConnect ?? false),
        });
    }
);

/**
 * Method used to toggle the mainnet options
 */
export const isMainnetEnableAtom = atom(
    (get) => get(betaOptionsAtom).mainnet ?? false,
    (get, set) => {
        const options = get(betaOptionsAtom);
        set(betaOptionsAtom, {
            ...options,
            mainnet: !(options.mainnet ?? false),
        });
    }
);
