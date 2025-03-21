import { FullDialog } from "@/module/full/component/FullDialog";
import { SendInteraction } from "@/module/interaction/component/SendInteraction";
import { SendReferralInteraction } from "@/module/interaction/component/SendReferralInteraction";
import { ProductInfo } from "@/module/productInfo/component/WalletStatus";
import { SendTransaction } from "@/module/transaction/component/SendTx";
import { WalletLogin } from "@/module/wallet/component/WalletLogin";
import { WalletStatus } from "@/module/wallet/component/WalletStatus";

export default function Home() {
    return (
        <div>
            <h1>Frak Wallet Demo Eth-CC @Frak-labs</h1>

            <WalletStatus />
            <ProductInfo />
            <FullDialog />
            <WalletLogin />
            <SendTransaction />
            <SendReferralInteraction />
            <SendInteraction />
        </div>
    );
}
