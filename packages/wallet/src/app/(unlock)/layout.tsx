import { Header } from "@/module/common/component/Header";
import { WalletProvider } from "@/module/wallet/provider/WalletProvider";
import type { ReactNode } from "react";

export default async function RestrictedLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    return (
        <WalletProvider>
            <Header navigation={false} authenticated={true} />
            {children}
        </WalletProvider>
    );
}
