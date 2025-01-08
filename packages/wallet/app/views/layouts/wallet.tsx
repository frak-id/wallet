import { PrivyProvider } from "@/module/common/provider/PrivyProvider";
import { PrivyWalletMessageProvider } from "@/module/common/provider/PrivyWalletMessageProvider";
import { Outlet } from "react-router";

export default function WalletLayout() {
    return (
        <PrivyProvider>
            <PrivyWalletMessageProvider />
            <Outlet />
        </PrivyProvider>
    );
}
