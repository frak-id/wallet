"use client";

import { getWalletConnectWallet } from "@/context/wallet-connect/provider";
import { isWalletConnectEnableAtom } from "@/module/settings/atoms/betaOptions";
import { useHandleWalletConnectEvents } from "@/module/wallet-connect/hook/useHandleWalletConnectEvents";
import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai/index";
import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";

function useWalletConnectHook() {
    /**
     * Check if the wallet connect feature is wanted
     */
    const isEnabled = useAtomValue(isWalletConnectEnableAtom);

    /**
     * Get the wallet connect instance
     *  Multiple refetch only here to ensure that our DI instance is well defined
     */
    const { data: walletConnectInstance, status } = useQuery({
        queryKey: ["wallet-connect"],
        queryFn: getWalletConnectWallet,
        refetchInterval: false,
        refetchOnMount: true,
        refetchOnReconnect: true,
        enabled: isEnabled,
    });

    /**
     * Check if the wallet connect instance is initialised
     */
    const isInitialised = useMemo(() => {
        return status === "success";
    }, [status]);

    /**
     * Setup our event listener
     */
    useHandleWalletConnectEvents({ walletConnectInstance });

    return useMemo(
        () => ({
            isInitialised,
            walletConnectInstance,
        }),
        [isInitialised, walletConnectInstance]
    );
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
