"use client";

import { useLocalStorage } from "@/module/common/hook/useLocalStorage";
import type { Session } from "@/types/Session";
import { type ReactNode, createContext, useCallback, useContext } from "react";
import { isAddressEqual } from "viem";

type LastAuthentication = Session;

function useLastAuthenticationsHook() {
    /**
     * TODO: Should we experiment with IndexedDb here? With Dexie/IDB/idb-keyval? Idk what's the best, maybe ussing zustand and a wrapper arround it?
     */
    const [lastAuthentications, setLastAuthentications] = useLocalStorage<
        LastAuthentication[] | null
    >("lastAuthentications", null);

    // Add a last authentication
    const addLastAuthentication = useCallback(
        (authentication: LastAuthentication) => {
            setLastAuthentications((lastAuthentications) => {
                const currentAuthentications = lastAuthentications ?? [];
                // Check if the same wallet is already present
                const sameWalletAlreadyPresent = currentAuthentications.some(
                    (auth) =>
                        isAddressEqual(
                            auth.wallet.address,
                            authentication.wallet.address
                        )
                );
                // If yes, return the same array
                if (sameWalletAlreadyPresent) {
                    // If yes, return the same array
                    return lastAuthentications;
                }

                // If not, add the new authentication
                return [authentication, ...currentAuthentications];
            });
        },
        [setLastAuthentications]
    );

    // Remove a last authentication
    const removeLastAuthentication = useCallback(
        (authentication: LastAuthentication) => {
            setLastAuthentications((lastAuthentications) => {
                // Get the current authentications
                const currentAuthentications = lastAuthentications ?? [];

                // Remove the authentication and return the new array
                return currentAuthentications.filter(
                    (auth) =>
                        !isAddressEqual(
                            auth.wallet.address,
                            authentication.wallet.address
                        )
                );
            });
        },
        [setLastAuthentications]
    );

    return {
        wasAuthenticated: (lastAuthentications?.length ?? 0) > 0,
        lastAuthentications,
        // Update last authentication
        addLastAuthentication,
        removeLastAuthentication,
    };
}

type UseLastAuthenticationsHook = ReturnType<typeof useLastAuthenticationsHook>;
const LastAuthenticationsContext =
    createContext<UseLastAuthenticationsHook | null>(null);

export const useLastAuthentications = (): UseLastAuthenticationsHook => {
    const context = useContext(LastAuthenticationsContext);
    if (!context) {
        throw new Error(
            "useLastAuthentications hook must be used within a LastAuthenticationsProvider"
        );
    }
    return context;
};

export function LastAuthenticationsProvider({
    children,
}: { children: ReactNode }) {
    const hook = useLastAuthenticationsHook();

    return (
        <LastAuthenticationsContext.Provider value={hook}>
            {children}
        </LastAuthenticationsContext.Provider>
    );
}
