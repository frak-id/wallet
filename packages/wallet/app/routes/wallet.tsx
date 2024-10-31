import { RestrictedLayout } from "@/module/layout/RestrictedLayout";
import { Wallet } from "@/module/wallet/component/Home";

export default function WalletRoute() {
    return (
        <RestrictedLayout>
            <Wallet />
        </RestrictedLayout>
    );
}
