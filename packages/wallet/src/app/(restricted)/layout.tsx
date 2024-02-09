import { getSession } from "@/context/session/action/session";
import { AuthGate } from "@/module/authentication/component/AuthGate";
import { HeaderRestricted } from "@/module/common/component/Header";
import { WalletProvider } from "@/module/wallet/provider/WalletProvider";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default async function RestrictedLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    // Check if a user is logged in or not
    const session = await getSession();

    // If we don't have a session, redirect to root
    if (!session) {
        redirect("/");
    }
    return (
        <AuthGate>
            <WalletProvider session={session}>
                <HeaderRestricted />
                {children}
            </WalletProvider>
        </AuthGate>
    );
}
