import { Header } from "@/module/common/component/Header";
import { MainLayout } from "@/module/common/component/MainLayout";
import { Navigation } from "@/module/common/component/Navigation";
import type { ReactNode } from "react";
import "./layout.css";

export default function RestrictedLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    return (
        <>
            <Header />
            <Navigation />
            <MainLayout>{children}</MainLayout>
        </>
    );
}
