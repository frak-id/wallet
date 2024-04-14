"use client";

import { smartAccountConnector } from "@/context/wallet/smartWallet/connector";
import { useEffect, useMemo } from "react";
import { useConfig, useConnect } from "wagmi";

/**
 * Hook that enforce wagmi connection
 */
export function useEnforceWagmiConnection() {
    /**
     * Get the current wagmi state
     */
    const { state, connectors } = useConfig();

    /**
     * Extract the nexus connector
     */
    const nexusConnector = useMemo(
        () =>
            connectors.find(
                (connector) => connector.type === smartAccountConnector.type
            ),
        [connectors]
    );

    /**
     * Connect to the nexus connector
     */
    const { connect, isPending } = useConnect();

    useEffect(() => {
        console.log("Checking for manual connection to nexus connector", {
            status: state.status,
            current: state.current,
            isPending,
            nexusConnector,
        });
        // If we are not disconnected, early exit
        if (
            state.status !== "disconnected" &&
            state.current === nexusConnector?.uid
        ) {
            return;
        }

        // If we are currently connecting, do nothing
        if (isPending) {
            return;
        }

        // If the nexus connector isn't found, do nothing
        if (!nexusConnector) {
            return;
        }

        // And then connect to it
        console.log("Manually connecting to nexus connector", {
            status: state.status,
            current: state.current,
        });
        connect({ connector: nexusConnector });
    }, [connect, nexusConnector, isPending, state.current, state.status]);
}
