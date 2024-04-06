"use client";

import { getWalletConnectWallet } from "@/context/wallet-connect/provider";
import { isWalletConnectEnableAtom } from "@/module/settings/atoms/betaOptions";
import { useQuery } from "@tanstack/react-query";
import type { SessionTypes } from "@walletconnect/types";
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
     * Get the active wallet sessions
     */
    const { data: sessions, refetch: refreshSessions } = useQuery({
        queryKey: [
            "wallet-connect-sessions",
            walletConnectInstance?.name ?? "no-name",
            walletConnectInstance?.core?.context ?? "no-context",
        ],
        enabled: !!walletConnectInstance,
        queryFn: () =>
            Object.values(
                walletConnectInstance?.getActiveSessions() ?? {}
            ) as SessionTypes.Struct[],
        placeholderData: [] as SessionTypes.Struct[],
        refetchInterval: false,
        refetchOnMount: true,
        refetchOnReconnect: true,
    });

    /**
     * Check if the wallet connect instance is initialised
     */
    const isInitialised = useMemo(() => {
        return status === "success";
    }, [status]);

    return useMemo(
        () => ({
            isInitialised,
            walletConnectInstance,
            sessions,
            refreshSessions,
        }),
        [isInitialised, walletConnectInstance, sessions, refreshSessions]
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
