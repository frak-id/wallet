"use client";

import { Panel } from "@/module/common/component/Panel";
import type { WalletStatusReturnType } from "@frak-labs/nexus-sdk/core";
import { useWalletStatus } from "@frak-labs/nexus-sdk/react";
import Link from "next/link";

export function WalletStatus() {
    const { data: walletStatus } = useWalletStatus();

    return (
        <Panel variant={"primary"}>
            <h2>Wallet Status</h2>
            <InnerStatus status={walletStatus} />
            <Link href={process.env.NEXUS_WALLET_URL ?? ""}>
                Check on Nexus
            </Link>
        </Panel>
    );
}

function InnerStatus({
    status,
}: {
    status?: Readonly<WalletStatusReturnType | { key: "waiting-response" }>;
}) {
    if (!status || status.key === "waiting-response") {
        return <div>Loading...</div>;
    }

    if (status.key === "not-connected") {
        return <div>You are not connected with a Nexus Wallet</div>;
    }

    return (
        <div>
            Currently connected with the Nexus: <b>{status.wallet}</b>
        </div>
    );
}
