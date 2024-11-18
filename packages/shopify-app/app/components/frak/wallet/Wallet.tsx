import { useWalletStatus } from "@frak-labs/nexus-sdk/react";

export function Wallet() {
    const { data: walletStatus } = useWalletStatus();

    if (walletStatus === undefined) {
        return <div>Loading...</div>;
    }

    return (
        <div>
            <h1>Current wallet</h1>
            <p>Status: {walletStatus.wallet ?? "No wallet"}</p>
        </div>
    );
}
