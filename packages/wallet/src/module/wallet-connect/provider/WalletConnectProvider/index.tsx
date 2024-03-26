"use client";

import { getWalletConnectWallet } from "@/context/wallet-connect/provider";
import type { PairingTypes, SessionTypes } from "@walletconnect/types";
import type Web3Wallet from "@walletconnect/web3wallet";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

function useWalletConnectHook() {
    const [walletConnectInstance, setWalletConnectInstance] =
        useState<Web3Wallet>();
    const [sessions, setSessions] = useState<SessionTypes.Struct[]>([]);
    const [pairings, setPairings] = useState<PairingTypes.Struct[]>([]);

    useEffect(() => {
        getWalletConnectWallet().then((walletConnectClient) => {
            setWalletConnectInstance(walletConnectClient);
            setSessions(walletConnectClient.engine.signClient.session.values);
            setPairings(walletConnectClient.core.pairing.getPairings());

            walletConnectClient.engine.signClient.events.on(
                "session_delete",
                async (event) => {
                    const { topic, id } = event;
                    console.log("session_delete", { topic, id });
                }
            );
            walletConnectClient.core.pairing.events?.on(
                "pairing_delete",
                async (event) => {
                    const { topic, id } = event;
                    console.log("pairing_delete", { topic, id });
                }
            );
        });
    }, []);

    function setInstanceData() {
        if (!walletConnectInstance) return;
        setSessions(walletConnectInstance.engine.signClient.session.values);
        setPairings(walletConnectInstance.core.pairing.getPairings());
    }

    return useMemo(() => {
        return {
            walletConnectInstance,
            sessions,
            setSessions,
            pairings,
            setPairings,
            setInstanceData,
        };
    }, [walletConnectInstance, sessions, pairings]);
}

type UseWalletConnectHook = ReturnType<typeof useWalletConnectHook>;
const WalletConnectContext = createContext<UseWalletConnectHook | null>(null);

export const useWalletConnect = (): UseWalletConnectHook => {
    const context = useContext(WalletConnectContext);
    if (!context) {
        throw new Error(
            "useWalletConnect hook must be used within a WalletConnectProvider"
        );
    }
    return context;
};

export function WalletConnectProvider({ children }: { children: ReactNode }) {
    const hook = useWalletConnectHook();

    return (
        <WalletConnectContext.Provider value={hook}>
            {children}
        </WalletConnectContext.Provider>
    );
}
