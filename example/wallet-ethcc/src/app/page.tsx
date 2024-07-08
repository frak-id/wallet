import { SendInteraction } from "@/module/interaction/component/SendInteraction";
import { SendTransaction } from "@/module/transaction/component/SendTx";
import { WalletLogin } from "@/module/wallet/component/WalletLogin";
import { WalletStatus } from "@/module/wallet/component/WalletStatus";

export default function HomePage() {
    return (
        <div>
            <h1>Nexus Demo Eth-CC @Frak-labs</h1>

            <WalletStatus />
            <WalletLogin />
            <SendTransaction />
            <SendInteraction />
        </div>
    );
}
