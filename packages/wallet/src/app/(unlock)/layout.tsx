import { Header } from "@/module/common/component/Header";
import { WalletLoader } from "@/module/wallet/component/WalletLoader";
import type { ReactNode } from "react";

export default async function RestrictedLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    return (
        <WalletLoader>
            <Header navigation={false} authenticated={true} />
            {children}
        </WalletLoader>
    );
}
