import { isPrivyEnabled } from "@/context/blockchain/privy";
import { PrivySdkProvider } from "@/module/common/provider/PrivySdkProvider";
import { Outlet } from "react-router";

export default function SdkLayout() {
    if (!isPrivyEnabled) {
        return <Outlet />;
    }

    return (
        <PrivySdkProvider>
            <Outlet />
        </PrivySdkProvider>
    );
}
