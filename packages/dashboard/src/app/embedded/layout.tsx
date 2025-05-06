import type { ReactNode } from "react";
import "./layout.css";
import { MainLayout } from "@/module/common/component/MainLayout";

export default function EmbeddedLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    return <MainLayout>{children}</MainLayout>;
}
