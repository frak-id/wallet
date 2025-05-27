import { AuthRestricted } from "@/module/common/component/AuthRestricted";
import { GlobalLayout } from "@/module/common/component/GlobalLayout";
import { Outlet } from "react-router";

export default function AuthenticationLayout() {
    return (
        <AuthRestricted requireAuthenticated={false}>
            <GlobalLayout>
                <Outlet />
            </GlobalLayout>
        </AuthRestricted>
    );
}
