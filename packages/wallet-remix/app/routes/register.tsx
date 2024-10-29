import { Register } from "@/module/authentication/component/Register";
import { AuthenticationLayout } from "@/module/layout/AuthenticationLayout";
import { Outlet } from "@remix-run/react";

export default function RegisterRoute() {
    return (
        <AuthenticationLayout>
            <Register />
            <Outlet />
        </AuthenticationLayout>
    );
}
