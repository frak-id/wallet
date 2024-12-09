import {
    type FrakWalletConnector,
    smartAccountConnector,
} from "@/context/wallet/smartWallet/connector";
import { useSignMessage } from "@privy-io/react-auth";
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
    const frakConnector = useMemo(
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
        // If we are not disconnected, early exit
        if (
            state.status !== "disconnected" &&
            state.current === frakConnector?.uid
        ) {
            return;
        }

        // If we are currently connecting, do nothing
        if (isPending) {
            return;
        }

        // If the frak connector isn't found, do nothing
        if (!frakConnector) {
            return;
        }

        // And then connect to it
        console.log("Manually connecting to frak wallet connector", {
            status: state.status,
            current: state.current,
        });
        connect({ connector: frakConnector });
    }, [connect, frakConnector, isPending, state.current, state.status]);

    /**
     * Synchronise the privy sign message with the frak connector
     */
    const { signMessage } = useSignMessage();
    useEffect(() => {
        if (!frakConnector) {
            return;
        }

        // Update the privy wallets from the frak connectors
        (
            frakConnector as unknown as FrakWalletConnector
        ).onPrivyInterfaceUpdate(signMessage);
    }, [signMessage, frakConnector]);
}
