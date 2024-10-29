import { RestrictedLayout } from "@/module/layout/RestrictedLayout";
import { Outlet } from "@remix-run/react";

export default function WalletRoute() {
    return (
        <RestrictedLayout>
            <Outlet />
        </RestrictedLayout>
    );
}
