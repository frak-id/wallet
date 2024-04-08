import { Header } from "@/module/common/component/Header";
import type { ReactNode } from "react";

export default async function AuthenticationLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    return (
        <>
            <Header navigation={false} />
            {children}
        </>
    );
}
