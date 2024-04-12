"use client";

import type { SmartAccountProvider } from "@/context/wallet/smartWallet/connector";
import { smartAccountBuilderAtom } from "@/module/common/atoms/clients";
import { smartWalletConnectAtom } from "@/module/common/atoms/wagmi";
import { useAtomValue } from "jotai/index";
import type { ENTRYPOINT_ADDRESS_V06_TYPE } from "permissionless/types";
import { useEffect } from "react";
import { useConnect } from "wagmi";

/**
 * Hook used to setup the smart wallet
 */
export function useSmartWalletConnectorSetup() {
    /**
     * Hook to connect the wagmi connector to the smart wallet client
     */
    const { connectors } = useConnect();

    /**
     * Get our smart wallet connector builder
     */
    const connector = useAtomValue(smartWalletConnectAtom);

    const builder = useAtomValue(smartAccountBuilderAtom);

    useEffect(() => {
        const nexusConnector = connectors.find(
            (c) => c.id === "nexus-connector"
        );
        console.log("nexusConnector", { nexusConnector, connectors });
        if (!nexusConnector) {
            return;
        }
        nexusConnector
            .getProvider()
            .then((p) =>
                (
                    p as SmartAccountProvider<ENTRYPOINT_ADDRESS_V06_TYPE>
                ).onBuilderChange(builder)
            );
    }, [connector, builder]);
}
