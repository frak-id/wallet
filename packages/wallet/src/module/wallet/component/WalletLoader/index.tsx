"use client";

import { useSmartWalletConnectorSetup } from "@/module/wallet/hook/useSmartWalletConnectorSetup";
import { type PropsWithChildren, useEffect, useMemo } from "react";
import { useConnectorClient } from "wagmi";

/**
 * Component locking the UI until the wallet is loaded and rdy to use
 * @constructor
 */
export function WalletLoader({ children }: PropsWithChildren) {
    /**
     * Hook used to setup the smart wallet
     */
    useSmartWalletConnectorSetup();

    /**
     * Hook to listen to the current connection
     */
    const { status: connectorClientStatus } = useConnectorClient();

    useEffect(() => {
        console.log("Connector client has changed", {
            connectorClientStatus,
        });
    }, [connectorClientStatus]);

    return useMemo(() => {
        if (connectorClientStatus === "pending") {
            return <div>Loading wallet...</div>;
        }

        if (connectorClientStatus === "error") {
            return <div>Wallet connection error</div>;
        }

        return children;
    }, [connectorClientStatus, children]);
}
