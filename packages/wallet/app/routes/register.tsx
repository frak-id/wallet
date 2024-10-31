import { Register } from "@/module/authentication/component/Register";
import { AuthenticationLayout } from "@/module/layout/AuthenticationLayout";

export default function RegisterRoute() {
    return (
        <AuthenticationLayout>
            <Register />
        </AuthenticationLayout>
    );
}
