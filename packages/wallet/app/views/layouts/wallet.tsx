import { isPrivyEnabled } from "@/context/blockchain/privy";
import { PrivyWalletProvider } from "@/module/common/provider/PrivyWalletProvider";
import { Outlet } from "react-router";

export default function WalletLayout() {
    if (!isPrivyEnabled) {
        return <Outlet />;
    }

    return (
        <PrivyWalletProvider>
            <Outlet />
        </PrivyWalletProvider>
    );
}
