import { getSession } from "@/context/session/action/session";
import { LastAuthenticationsProvider } from "@/module/authentication/providers/LastAuthentication";
import { Header } from "@/module/common/component/Header";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default async function AuthenticationLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    // Check if a user is logged in or not
    const session = await getSession();

    // If we don't have a session, redirect to register
    if (session) {
        redirect("/wallet");
    }
    return (
        <LastAuthenticationsProvider>
            <Header navigation={false} />
            {children}
        </LastAuthenticationsProvider>
    );
}
