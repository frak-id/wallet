import { GlobalLayout } from "@/module/common/component/GlobalLayout";
import { Outlet } from "@remix-run/react";

export default function SsoLayout() {
    return (
        <GlobalLayout header={false}>
            <Outlet />
        </GlobalLayout>
    );
}
