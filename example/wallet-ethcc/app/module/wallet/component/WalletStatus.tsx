import type { WalletStatusReturnType } from "@frak-labs/core-sdk";
import { useWalletStatus } from "@frak-labs/react-sdk";
import { Panel } from "@/module/common/component/Panel";

export function WalletStatus() {
    const { data: walletStatus } = useWalletStatus();

    return (
        <Panel variant={"primary"}>
            <h2>Wallet Status</h2>
            <InnerStatus status={walletStatus} />
            <a href={process.env.FRAK_WALLET_URL ?? ""}>Check on Frak Wallet</a>
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
