import { Outlet } from "react-router";
import { GlobalLayout } from "@/module/common/component/GlobalLayout";

export default function SsoLayout() {
    return (
        <GlobalLayout header={false}>
            <Outlet />
        </GlobalLayout>
    );
}
