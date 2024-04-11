"use client";

import { sessionAtom } from "@/module/common/atoms/session";
import { useSmartWalletConnector } from "@/module/wallet/hook/useSmartWalletConnector";
import { useAtomValue } from "jotai/index";
import { useEffect } from "react";
import { useConfig, useConnect } from "wagmi";

/**
 * Hook used to setup the smart wallet
 */
export function useSmartWalletConnectorSetup() {
    /**
     * Current user session
     */
    const { wallet } = useAtomValue(sessionAtom) ?? {};

    /**
     * Hook to connect the wagmi connector to the smart wallet client
     */
    const { connect } = useConnect();

    /**
     * Get the current wagmi config
     */
    const config = useConfig();

    /**
     * Get our smart wallet connector builder
     */
    const connector = useSmartWalletConnector({ config, wallet });

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
}
