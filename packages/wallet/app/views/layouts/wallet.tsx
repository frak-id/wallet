import { PrivyWalletProvider } from "@/module/common/provider/PrivyWalletProvider";
import { Outlet } from "react-router";

export default function WalletLayout() {
    return (
        <PrivyWalletProvider>
            <Outlet />
        </PrivyWalletProvider>
    );
}
