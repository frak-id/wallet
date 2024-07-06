import { WalletLogin } from "@/module/wallet/component/WalletLogin";
import { WalletStatus } from "@/module/wallet/component/WalletStatus";

export default function HomePage() {
    return (
        <div>
            <h1>Nexus Demo Eth-CC @Frak-labs</h1>

            <WalletStatus />
            <WalletLogin />
        </div>
    );
}
