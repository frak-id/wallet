import { PrivySdkProvider } from "@/module/common/provider/PrivySdkProvider";
import { Outlet } from "react-router";

export default function SdkLayout() {
    return (
        <PrivySdkProvider>
            <Outlet />
        </PrivySdkProvider>
    );
}
