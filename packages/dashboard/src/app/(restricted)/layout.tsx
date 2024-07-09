import { Header } from "@/module/common/component/Header";
import { MainLayout } from "@/module/common/component/MainLayout";
import { Navigation } from "@/module/common/component/Navigation";
import { ClientOnly } from "@module/component/ClientOnly";
import type { ReactNode } from "react";

export default function RestrictedLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    return (
        <>
            <Header />
            <ClientOnly>
                <Navigation />
            </ClientOnly>
            <MainLayout>{children}</MainLayout>
        </>
    );
}
