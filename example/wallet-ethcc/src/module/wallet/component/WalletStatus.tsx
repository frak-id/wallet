"use client";

import { useWalletStatus } from "@frak-labs/nexus-sdk/react";
import { useMemo } from "react";

export function WalletStatus() {
    const { data: walletStatus } = useWalletStatus();

    return useMemo(() => {
        if (!walletStatus || walletStatus.key === "waiting-response") {
            return <>Loading...</>;
        }

        if (walletStatus.key === "connected") {
            return (
                <>
                    You are currently connected with the Nexus:{" "}
                    <b>{walletStatus.wallet}</b>
                </>
            );
        }
        if (walletStatus.key === "not-connected") {
            return <>You are not connected with a Nexus Wallet</>;
        }
    }, [walletStatus]);
}
