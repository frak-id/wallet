import "@/styles/all.css";
import { Fonts } from "@/module/common/component/Fonts";
import { MainLayout } from "@/module/common/component/MainLayout";
import { RootProvider } from "@/module/common/provider/RootProvider";
import type { Metadata, Viewport } from "next";
import { ViewTransitions } from "next-view-transitions";
import type { ReactNode } from "react";

export const metadata: Metadata = {
    title: "Good Vibes by Frak",
    applicationName: "Good Vibes - Frak",
    description: "Good Vibes website using Frak Wallet.",
    authors: [
        { name: "Frak labs", url: "https://frak.id/" },
        { name: "Rodolphe Stoclin", url: "https://github.com/srod" },
        { name: "Quentin Nivelais", url: "https://github.com/KONFeature" },
    ],
    icons: {
        icon: [
            { rel: "icon", url: "/favicons/favicon.ico", sizes: "48x48" },
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
    keywords: ["frak", "wallet", "frak-wallet", "blockchain"],
};

export const viewport: Viewport = {
    themeColor: "#ffffff",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    return (
        <ViewTransitions>
            <html lang="en">
                <body>
                    <Fonts />
                    <RootProvider>
                        <MainLayout>{children}</MainLayout>
                    </RootProvider>
                </body>
            </html>
        </ViewTransitions>
    );
}
