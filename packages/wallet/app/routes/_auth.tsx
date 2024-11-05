import { AuthRestricted } from "@/module/common/component/AuthRestricted";
import { GlobalLayout } from "@/module/common/component/GlobalLayout";
import { Header } from "@/module/common/component/Header";
import { Outlet } from "@remix-run/react";

export default function AuthenticationLayout() {
    return (
        <AuthRestricted requireAuthenticated={false}>
            <GlobalLayout>
                <Header />
                <Outlet />
            </GlobalLayout>
        </AuthRestricted>
    );
}
