import { Outlet } from "react-router";
import { AuthRestricted } from "@/module/common/component/AuthRestricted";
import { GlobalLayout } from "@/module/common/component/GlobalLayout";

export default function AuthenticationLayout() {
    return (
        <AuthRestricted requireAuthenticated={false}>
            <GlobalLayout>
                <Outlet />
            </GlobalLayout>
        </AuthRestricted>
    );
}
