import { RootProvider } from "@/module/common/provider/RootProvider";
import "@/styles/all.css";
import { getFullSessionStatus } from "@/context/interaction/action/interactionSession";
import { SetPresenceCookie } from "@/module/authentication/component/SetPresenceCookie";
import { isRunningInProd } from "@frak-labs/app-essentials";
import type { Metadata, Viewport } from "next";
import { Sora } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import type { ReactNode } from "react";

const sora = Sora({
    subsets: ["latin"],
    variable: "--font-family",
    fallback: ["--font-family-sans"],
    weight: ["400", "500", "700"],
    display: "swap",
});

export const metadata: Metadata = {
    title: "Frak Wallet | Your Web3 Identity & Reward Hub",
    applicationName: "Frak Wallet",
    description:
        "Frak Wallet: Your passkey-first smart wallet for a unified web identity. Earn rewards through website interactions, seamlessly integrate with partner sites, and manage your digital assets securely.",
    authors: [
        { name: "Frak labs", url: "https://frak.id/" },
        { name: "Rodolphe Stoclin", url: "https://github.com/srod" },
        { name: "Quentin Nivelais", url: "https://github.com/KONFeature" },
    ],
    icons: {
        icon: [
            { rel: "icon", url: "/favicons/favicon.ico", sizes: "32x32" },
            { rel: "icon", url: "/favicons/icon.svg", type: "image/svg+xml" },
        ],
        apple: [
            {
                url: "/favicons/icon-192.png",
                type: "image/png",
            },
        ],
    },
    creator: "Frak labs",
    publisher: "Frak labs",
    manifest: "/manifest.json",
    keywords: [
        "frak",
        "frak-wallet",
        "blockchain wallet",
        "smart wallet",
        "web3 identity",
        "passkey",
        "digital rewards",
        "user engagement",
    ],
    openGraph: {
        type: "website",
        url: isRunningInProd
            ? "https://nexus.frak.id"
            : "https://nexus-dev.frak.id",
        title: "Frak Wallet | Your Web3 Identity & Reward Hub",
        description:
            "Manage your unified web identity, earn rewards, and interact seamlessly with partner websites using our passkey-first blockchain smart wallet.",
        siteName: "Frak Wallet",
    },
    twitter: {
        card: "summary_large_image",
        site: "@frak_defi",
        title: "Frak Wallet | Your Web3 Identity & Reward Hub",
        description:
            "Manage your unified web identity, earn rewards, and interact seamlessly with partner websites using our passkey-first blockchain smart wallet.",
    },
    appleWebApp: {
        capable: true,
        title: "Frak Wallet",
        statusBarStyle: "default",
    },
};

export const viewport: Viewport = {
    themeColor: "#001432",
};

export default async function RootLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    // Check if a user is logged in or not
    const { session, interactionSession } = await getFullSessionStatus();

    return (
        <html lang="en" suppressHydrationWarning>
            <body className={`scrollbars ${sora.className}`}>
                <NextTopLoader showSpinner={false} />
                <RootProvider
                    session={session}
                    interactionSession={interactionSession}
                >
                    {children}
                </RootProvider>
                <SetPresenceCookie />
            </body>
        </html>
    );
}
