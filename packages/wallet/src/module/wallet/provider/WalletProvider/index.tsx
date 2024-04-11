"use client";

import type { KernelWebAuthNSmartAccount } from "@/context/wallet/smartWallet/WebAuthNSmartWallet";
import { sessionAtom } from "@/module/common/atoms/session";
import { useAtomValue } from "jotai";
import type { SmartAccountClient } from "permissionless";
import type { ENTRYPOINT_ADDRESS_V06_TYPE } from "permissionless/types";
import { useMemo } from "react";
import { useConnectorClient } from "wagmi";

export function useWallet() {
    /**
     * Current user session
     */
    const { wallet, username } = useAtomValue(sessionAtom) ?? {};

    /**
     * Hook to listen to the current connection
     */
    const { data: connectorClient } = useConnectorClient();

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
