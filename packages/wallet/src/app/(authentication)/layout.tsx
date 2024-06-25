import { GlobalLayout } from "@/module/common/component/GlobalLayout";
import { Header } from "@/module/common/component/Header";
import type { ReactNode } from "react";

export default async function AuthenticationLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    return (
        <GlobalLayout>
            <Header navigation={false} />
            {children}
        </GlobalLayout>
    );
}
