import { GlobalLayout } from "@/module/common/component/GlobalLayout";
import { Header } from "@/module/common/component/Header";
import type { ReactNode } from "react";

export default async function RestrictedLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    return (
        <GlobalLayout>
            <Header navigation={false} authenticated={true} />
            {children}
        </GlobalLayout>
    );
}
