import { GlobalLayout } from "@/module/common/component/GlobalLayout";
import type { ReactNode } from "react";

export default async function AuthenticationLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    return <GlobalLayout>{children}</GlobalLayout>;
}
