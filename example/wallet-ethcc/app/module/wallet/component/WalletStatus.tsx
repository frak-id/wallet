import { Panel } from "@/module/common/component/Panel";
import type { WalletStatusReturnType } from "@frak-labs/nexus-sdk/core";
import { useWalletStatus } from "@frak-labs/nexus-sdk/react";
import { Link } from "react-router";

export function WalletStatus() {
    const { data: walletStatus } = useWalletStatus();

    return (
        <Panel variant={"primary"}>
            <h2>Wallet Status</h2>
            <InnerStatus status={walletStatus} />
            <Link to={process.env.FRAK_WALLET_URL ?? ""}>
                Check on Frak Wallet
            </Link>
        </Panel>
    );
}

function InnerStatus({
    status,
}: {
    status?: Readonly<WalletStatusReturnType>;
}) {
    if (!status) {
        return <div>Loading...</div>;
    }

    if (status.key === "not-connected") {
        return <div>You are not connected with a Frak Wallet</div>;
    }

    return (
        <div>
            Currently connected with the wallet: <b>{status.wallet}</b>
        </div>
    );
}
