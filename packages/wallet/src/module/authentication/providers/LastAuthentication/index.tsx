"use client";

import type { Session } from "@/types/Session";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/types";
import { useLocalStorage } from "@uidotdev/usehooks";
import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { isAddressEqual } from "viem";

export type LastAuthentication = Session & {
    transports?: AuthenticatorTransportFuture[];
};

function useLastAuthenticationsHook() {
    /**
     * All of the last authentications used
     */
    const [lastAuthentications, setLastAuthentications] = useLocalStorage<
        LastAuthentication[] | null
    >("lastAuthentications", null);

    /**
     * The last authentication used
     */
    const [lastAuthentication, setLastAuthentication] =
        useLocalStorage<LastAuthentication | null>("lastAuthentication", null);

    // Add a last authentication
    function addLastAuthentication(authentication: LastAuthentication) {
        // Define it as last authentication
        setLastAuthentication(authentication);

        // Add it to the last authentications
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
    }

    // Remove a last authentication
    function removeLastAuthentication(authentication: LastAuthentication) {
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
    }

    return {
        wasAuthenticated: !!lastAuthentication,
        lastAuthentication,
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
