"use client";

import type { KernelWebAuthNSmartAccount } from "@/context/wallet/smartWallet/WebAuthNSmartWallet";
import { sessionAtom } from "@/module/common/atoms/session";
import { useSmartWalletConnector } from "@/module/wallet/hook/useSmartWalletConnector";
import { useAtomValue } from "jotai";
import type { SmartAccountClient } from "permissionless";
import type { ENTRYPOINT_ADDRESS_V06_TYPE } from "permissionless/types";
import { createContext, useContext, useEffect } from "react";
import type { PropsWithChildren } from "react";
import { useMemo } from "react";
import { useConfig, useConnect, useConnectorClient } from "wagmi";

function useWalletHook() {
    /**
     * Current user session
     */
    const { wallet, username } = useAtomValue(sessionAtom) ?? {};

    /**
     * Hook to connect the wagmi connector to the smart wallet client
     */
    const { connect } = useConnect();

    /**
     * Hook to listen to the current connection
     */
    const { data: connectorClient, status: connectorClientStatus } =
        useConnectorClient();

    // TODO: If connector client status = "pending" then show a loading spinner

    const config = useConfig();
    const connector = useSmartWalletConnector({ config, wallet });

    useEffect(() => {
        console.log("Connector client has changed", {
            connectorClient,
            connectorClientStatus,
        });
    }, [connectorClient, connectorClientStatus]);

    /**
     * The current smart wallet
     */
    const smartWallet = useMemo(() => {
        if (!connectorClient?.account) {
            return;
        }

        return connectorClient.account as KernelWebAuthNSmartAccount;
    }, [connectorClient]);

    /**
     * Every time the smart wallet changes, we need to update the connector
     */
    const smartWalletClient = useMemo(() => {
        if (!connectorClient) {
            return;
        }

        // Build the smart wallet client
        return connectorClient as SmartAccountClient<ENTRYPOINT_ADDRESS_V06_TYPE>;
    }, [connectorClient]);

    /**
     * Every time the smart account changes, we need to update the connector
     */
    useEffect(() => {
        if (typeof connect !== "function") {
            return;
        }
        console.log("Connecting to smart wallet", connector);
        connect({ connector });
    }, [connect, connector]);

    return useMemo(
        () => ({
            address: smartWallet?.address,
            smartWallet,
            smartWalletClient,
            // Current session related
            username,
            wallet,
        }),
        [smartWallet, smartWalletClient, username, wallet]
    );
}

type UseWalletHook = ReturnType<typeof useWalletHook>;
const WalletContext = createContext<UseWalletHook | null>(null);

export const useWallet = (): UseWalletHook => {
    const context = useContext(WalletContext);
    if (!context) {
        throw new Error("useWallet hook must be used within a WalletProvider");
    }
    return context;
};

export function WalletProvider({ children }: PropsWithChildren) {
    const hook = useWalletHook();

    return (
        <WalletContext.Provider value={hook}>{children}</WalletContext.Provider>
    );
}
