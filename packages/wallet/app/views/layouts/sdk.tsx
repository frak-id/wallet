import { PrivyCoreProvider } from "@/module/common/provider/PrivyCoreProvider";
import { Outlet } from "react-router";

export default function SdkLayout() {
    return (
        <PrivyCoreProvider>
            <Outlet />
        </PrivyCoreProvider>
    );
}
