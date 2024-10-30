import { Login } from "@/module/authentication/component/Login";
import { AuthenticationLayout } from "@/module/layout/AuthenticationLayout";

export default function LoginRoute() {
    return (
        <AuthenticationLayout>
            <Login />
        </AuthenticationLayout>
    );
}
