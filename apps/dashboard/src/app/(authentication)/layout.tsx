import type { ReactNode } from "react";
import { AuthLayout } from "@/module/common/component/AuthLayout";
import "./layout.css";

export default function AuthenticationLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    return <AuthLayout>{children}</AuthLayout>;
}
