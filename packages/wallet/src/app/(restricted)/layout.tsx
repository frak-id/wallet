import { Header } from "@/module/common/component/Header";
import { WalletConnectModal } from "@/module/wallet-connect/component/ModalRequest";
import { WalletConnectProvider } from "@/module/wallet-connect/provider/WalletConnectProvider";
import type { ReactNode } from "react";

export default async function RestrictedLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    return (
        <WalletConnectProvider>
            <WalletConnectModal />
            <Header authenticated={true} />
            {children}
        </WalletConnectProvider>
    );
}
