import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AuthRestricted } from "@/module/common/component/AuthRestricted";
import { GlobalLayout } from "@/module/common/component/GlobalLayout";

export const Route = createFileRoute("/_wallet/_auth")({
    component: AuthenticationLayout,
});

function AuthenticationLayout() {
    return (
        <AuthRestricted requireAuthenticated={false}>
            <GlobalLayout>
                <Outlet />
            </GlobalLayout>
        </AuthRestricted>
    );
}
