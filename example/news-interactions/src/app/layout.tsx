import "@/styles/all.css";
import { Fonts } from "@/module/common/component/Fonts";
import { MainLayout } from "@/module/common/component/MainLayout";
import { RootProvider } from "@/module/common/provider/RootProvider";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
    title: "News with Nexus Wallet by Frak",
    applicationName: "News - Frak",
    description: "News paper website using Nexus Wallet by Frak.",
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
    keywords: ["frak", "blockchain", "nexus", "wallet", "ethcc"],
    // TODO: Twitter, openGraph, appleWebApp?
};

export const viewport: Viewport = {
    themeColor: "#001432",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    return (
        <html lang="en">
            <body>
                <Fonts />
                <RootProvider>
                    <MainLayout>{children}</MainLayout>
                </RootProvider>
            </body>
        </html>
    );
}
