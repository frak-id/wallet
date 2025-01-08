import { PrivyCoreProvider } from "@/module/common/provider/PrivyCoreProvider";
import { Outlet } from "react-router";

export default function WalletLayout() {
    return (
        <PrivyCoreProvider>
            <Outlet />
        </PrivyCoreProvider>
    );
}
