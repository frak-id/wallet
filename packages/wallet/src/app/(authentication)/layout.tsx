import { AuthGate } from "@/module/authentication/component/AuthGate";
import type { ReactNode } from "react";
import { Header } from "@/module/common/component/Header";

export default function AuthenticationLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    return (
        <AuthGate>
            <Header authenticated={false} />
            {children}
        </AuthGate>
    );
}
