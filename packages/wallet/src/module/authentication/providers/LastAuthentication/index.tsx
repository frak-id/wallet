"use client";

import type { PreviousAuthenticatorModel } from "@/context/common/dexie/PreviousAuthenticatorModel";
import { dexieDb } from "@/context/common/dexie/dexieDb";
import type { Session } from "@/types/Session";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/types";
import { useLiveQuery } from "dexie-react-hooks";
import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import useLocalStorageState from "use-local-storage-state";

type LastAuthentication = Session & {
    transports?: AuthenticatorTransportFuture[];
};

function useLastAuthenticationsHook() {
    /**
     * All of the last authentications used
     */
    const previousAuthenticators: PreviousAuthenticatorModel[] = useLiveQuery(
        () => dexieDb.previousAuthenticator.toArray(),
        [],
        []
    );

    /**
     * The last authentication used
     */
    const [lastAuthentication, setLastAuthentication] =
        useLocalStorageState<LastAuthentication | null>("lastAuthentication", {
            defaultValue: null,
        });

    // Add a last authentication
    async function addLastAuthentication(authentication: LastAuthentication) {
        // Define it as last authentication
        setLastAuthentication(authentication);

        // Add it to the last authentications
        await dexieDb.previousAuthenticator.put({
            wallet: authentication.wallet.address,
            username: authentication.username,
            authenticatorId: authentication.wallet.authenticatorId,
            transports: authentication.transports,
        });
    }

    // Remove a last authentication
    async function removeLastAuthentication(
        authentication: LastAuthentication
    ) {
        // Remove the authenticator
        await dexieDb.previousAuthenticator.delete({
            authenticatorId: authentication.wallet.authenticatorId,
        });
    }

    return {
        wasAuthenticated: !!lastAuthentication,
        lastAuthentication,
        previousAuthenticators,
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
