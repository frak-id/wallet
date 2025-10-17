import { DemoModeSync } from "@/module/common/component/DemoModeSync";
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
            <DemoModeSync />
            <Header />
            <Navigation />
            <MainLayout>{children}</MainLayout>
        </>
    );
}
