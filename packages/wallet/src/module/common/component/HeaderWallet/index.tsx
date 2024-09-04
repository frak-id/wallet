"use client";

import { currentChain } from "@/context/blockchain/provider";
import { WalletAddress } from "@module/component/WalletAddress";
import { useMemo } from "react";
import { useConnectorClient } from "wagmi";
import styles from "./index.module.css";

export function HeaderWallet() {
    const { data: connectorClient, status: connectionStatus } =
        useConnectorClient();

    return useMemo(() => {
        // If we got a client and an address, we can display the wallet
        if (connectorClient?.account?.address) {
            return (
                <span className={styles.header__wallet}>
                    <WalletAddress wallet={connectorClient.account.address} /> -{" "}
                    {currentChain.name}
                </span>
            );
        }

        return (
            <span className={styles.header__wallet}>{connectionStatus}</span>
        );
    }, [connectorClient, connectionStatus]);
}
