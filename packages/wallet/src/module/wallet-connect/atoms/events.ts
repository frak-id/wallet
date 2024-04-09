import type { WalletConnectRequestArgs } from "@/module/wallet-connect/types/event";
import { atom } from "jotai";

/**
 * All the current wallet connect requests
 */
export const wcRequestsAtom = atom<WalletConnectRequestArgs[]>([]);

/**
 * The currently displayed request
 */
export const wcDisplayedRequestAtom = atom<
    WalletConnectRequestArgs | undefined
>(undefined);

/**
 * Add a new request to the list
 */
export const wcAddNewRequestAtom = atom(
    null,
    (get, set, request: WalletConnectRequestArgs) => {
        // Ensure it's not present in the list yet, if yes directly exit
        const currentRequests = get(wcRequestsAtom);
        if (currentRequests.some((r) => r.id === request.id)) return;

        // Add it to the list
        set(wcRequestsAtom, [...get(wcRequestsAtom), request]);
        // Then, if there is no current request, display it
        if (!get(wcDisplayedRequestAtom)) {
            set(wcDisplayedRequestAtom, request);
        }
    }
);

/**
 * Remove a request from the list
 */
export const wcRemoveRequestAtom = atom(null, (get, set, id: number) => {
    // Remove the request from the list
    const filteredRequests = get(wcRequestsAtom).filter(
        (request) => request.id !== id
    );
    set(wcRequestsAtom, filteredRequests);
    // If the request was displayed, remove it
    if (get(wcDisplayedRequestAtom)?.id === id) {
        set(wcDisplayedRequestAtom, undefined);
    }
});
