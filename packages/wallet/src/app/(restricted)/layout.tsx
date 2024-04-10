import { Header } from "@/module/common/component/Header";
import { WalletConnectModal } from "@/module/wallet-connect/component/ModalRequest";
import { WalletConnectProvider } from "@/module/wallet-connect/provider/WalletConnectProvider";
import { WalletProvider } from "@/module/wallet/provider/WalletProvider";
import type { ReactNode } from "react";

export default async function RestrictedLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    return (
        <WalletProvider>
            <WalletConnectProvider>
                <WalletConnectModal />
                <Header authenticated={true} />
                {children}
            </WalletConnectProvider>
        </WalletProvider>
    );
}
