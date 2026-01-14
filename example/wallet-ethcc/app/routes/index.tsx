import { createFileRoute } from "@tanstack/react-router";
import { FullDialog } from "@/module/full/component/FullDialog";
import { ProductInfo } from "@/module/productInfo/component/WalletStatus";
import { Sso } from "@/module/sso/component/WalletStatus";
import { SendTransaction } from "@/module/transaction/component/SendTx";
import { WalletLogin } from "@/module/wallet/component/WalletLogin";
import { WalletStatus } from "@/module/wallet/component/WalletStatus";

export const Route = createFileRoute("/")({
    component: Home,
});

function Home() {
    return (
        <div>
            <h1>Frak Wallet Demo Eth-CC @Frak-labs</h1>

            <WalletStatus />
            <ProductInfo />
            <FullDialog />
            <Sso />
            <WalletLogin />
            <SendTransaction />
        </div>
    );
}
