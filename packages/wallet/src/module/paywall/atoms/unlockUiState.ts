import type { PaywallUnlockUiState } from "@/types/Unlock";
import { atom } from "jotai/index";

/**
 * Atom used to state the current unlock process ui state
 */
export const paywallUnlockUiStateAtom = atom<PaywallUnlockUiState>({
    idle: true,
});

export const isPaywallUnlockActionDisabledAtom = atom((get) => {
    const uiState = get(paywallUnlockUiStateAtom);
    // The main actions is disabled if we are in a loading state, but not in an idle one
    return !!uiState.loading;
});

export const paywallJoinCommunityDuringSetup = atom(false);
