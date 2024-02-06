import { HeaderAuthentication } from "@/module/authentication/component/Header";
import type { ReactNode } from "react";

export default function AuthenticationLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    return (
        <>
            <HeaderAuthentication />
            {children}
        </>
    );
}
