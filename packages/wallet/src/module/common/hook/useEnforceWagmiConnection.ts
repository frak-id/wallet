import { smartAccountConnector } from "@/context/wallet/smartWallet/connector";
import { useEffect, useMemo } from "react";
import { useConnect, useConnectorClient } from "wagmi";

/**
 * Hook that enforce wagmi connection
 * TODO: It can be rly spammy, should be optimized
 */
export function useEnforceWagmiConnection() {
    const { data: connectorClient } = useConnectorClient();

    const { connect, connectors, isPending, status } = useConnect();

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

    useEffect(() => {
        // If we are currently connecting, do nothing
        if (status === "pending") {
            return;
        }

        // If we got a connected client, do nothing
        if (connectorClient) {
            return;
        }

        // If not found, do nothing
        if (!nexusConnector) {
            return;
        }

        // And then connect to it
        console.log("Manually connecting to nexus connector", {
            nexusConnector,
            status,
            isPending,
            connectorClient,
        });
        connect({ connector: nexusConnector });
    }, [connect, nexusConnector, connectorClient, isPending, status]);
}
