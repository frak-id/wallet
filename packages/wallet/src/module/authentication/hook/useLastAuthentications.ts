import type { Session } from "@/types/Session";
import { useLocalStorage } from "@uidotdev/usehooks";
import { useCallback } from "react";
import { isAddressEqual } from "viem";

type LastAuthentication = Session;

/**
 * Simple hook to get last authentication data and set it
 */
export function useLastAuthentications() {
    /**
     * TODO: Should we experiment with IndexedDb here? With Dexie/IDB/idb-keyval? Idk what's the best, maybe ussing zustand and a wrapper arround it?
     */
    const [lastAuthentications, setLastAuthentications] = useLocalStorage<
        LastAuthentication[]
    >("lastAuthentications");

    // Add a last authentication
    const addLastAuthentication = useCallback(
        (authentication: LastAuthentication) => {
            setLastAuthentications((lastAuthentications) => {
                // Check if the same wallet is already present
                const sameWalletAlreadyPresent = lastAuthentications.some(
                    (auth) =>
                        isAddressEqual(
                            auth.wallet.address,
                            authentication.wallet.address
                        )
                );
                if (sameWalletAlreadyPresent) {
                    // If yes, return the same array
                    return lastAuthentications;
                }

                return [
                    authentication,
                    ...lastAuthentications.filter(
                        (auth) => auth.username !== authentication.username
                    ),
                ];
            });
        },
        [setLastAuthentications]
    );

    return {
        lastAuthentications,
        addLastAuthentication,
    };
}
