import { PrivyProvider } from "@/module/common/provider/PrivyProvider";
import { Outlet } from "react-router";

export default function SdkLayout() {
    return (
        <PrivyProvider>
            <Outlet />
        </PrivyProvider>
    );
}
