import { Header } from "@/module/common/component/Header";
import type { ReactNode } from "react";

export default async function RestrictedLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    return (
        <>
            <Header navigation={false} authenticated={true} />
            {children}
        </>
    );
}
