import { PrivyProvider } from "@/module/common/provider/PrivyProvider";
import { PrivySdkMessageProvider } from "@/module/common/provider/PrivySdkMessageProvider";
import { Outlet } from "react-router";

export default function SdkLayout() {
    return (
        <PrivyProvider>
            <PrivySdkMessageProvider />
            <Outlet />
        </PrivyProvider>
    );
}
