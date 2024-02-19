import { LastAuthenticationsProvider } from "@/module/authentication/providers/LastAuthentication";
import { Header } from "@/module/common/component/Header";
import type { ReactNode } from "react";

export default function AuthenticationLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    return (
        <LastAuthenticationsProvider>
            <Header navigation={false} />
            {children}
        </LastAuthenticationsProvider>
    );
}
