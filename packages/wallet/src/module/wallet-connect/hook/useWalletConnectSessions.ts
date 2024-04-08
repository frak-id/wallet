import { useWalletConnect } from "@/module/wallet-connect/provider/WalletConnectProvider";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { SessionTypes } from "@walletconnect/types";
import { useCallback, useMemo } from "react";

/**
 * Get all the active wallet connect sessions
 */
export function useWalletConnectSessions() {
    const { walletConnectInstance } = useWalletConnect();

    const { data: sessions } = useQuery({
        queryKey: ["wc-sessions"],
        enabled: !!walletConnectInstance,
        queryFn: () =>
            Object.values(
                walletConnectInstance?.getActiveSessions() ?? {}
            ) as SessionTypes.Struct[],
        placeholderData: [] as SessionTypes.Struct[],
        refetchInterval: false,
        refetchOnMount: true,
        refetchOnReconnect: true,
        meta: {
            storable: false,
        },
    });

    return useMemo(() => sessions ?? [], [sessions]);
}

/**
 * Invalidate the wallet connect sessions
 */
export function useInvalidateWalletConnectSessions() {
    const queryClient = useQueryClient();

    return useCallback(
        async () =>
            queryClient.invalidateQueries({
                queryKey: ["wc-sessions"],
                exact: true,
            }),
        [queryClient]
    );
}
