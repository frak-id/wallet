import { GlobalLayout } from "@/module/common/component/GlobalLayout";
import { Outlet } from "react-router";

export default function SsoLayout() {
    return (
        <GlobalLayout header={false}>
            <Outlet />
        </GlobalLayout>
    );
}
