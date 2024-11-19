import { AuthRestricted } from "@/module/common/component/AuthRestricted";
import { GlobalLayout } from "@/module/common/component/GlobalLayout";
import { Outlet } from "@remix-run/react";

export default function ProtectedLayout() {
    return (
        <AuthRestricted requireAuthenticated={true}>
            <GlobalLayout navigation={true}>
                <Outlet />
            </GlobalLayout>
        </AuthRestricted>
    );
}
