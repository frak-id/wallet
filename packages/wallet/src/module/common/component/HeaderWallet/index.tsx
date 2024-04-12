"use client";

import {
    type AvailableChainIds,
    availableChains,
} from "@/context/common/blockchain/provider";
import { WalletAddress } from "@/module/wallet/component/WalletAddress";
import { useMemo } from "react";
import { extractChain } from "viem";
import { useConnectorClient } from "wagmi";
import styles from "./index.module.css";

export function HeaderWallet() {
    const { data: connectorClient, status: connectionStatus } =
        useConnectorClient();

    const component = useMemo(() => {
        // If we got a client and an address, we can display the wallet
        if (connectorClient?.account?.address) {
            // Get the chain name
            const chainName = extractChain({
                chains: availableChains,
                id: connectorClient.chain.id as AvailableChainIds,
            }).name;

            return (
                <span className={styles.header__wallet}>
                    <WalletAddress wallet={connectorClient.account.address} /> -{" "}
                    {chainName}
                </span>
            );
        }

        return (
            <span className={styles.header__wallet}>{connectionStatus}</span>
        );
    }, [connectorClient, connectionStatus]);

    return component;
}
