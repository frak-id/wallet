import { Fonts } from "@/module/common/component/Fonts";
import { RootProvider } from "@/module/common/provider/RootProvider";
import "@/styles/all.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "../polyfill/bigint-serialization";

export const metadata: Metadata = {
    title: "Nexus Dashboard by Frak",
    applicationName: "Nexus Dashboard",
    description:
        "The simple and cross-platform wallet to centralise your contents.",
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
    keywords: ["dashboard", "community", "frak", "blockchain", "nexus"],
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
            <Fonts />
            <body>
                <RootProvider>{children}</RootProvider>
            </body>
        </html>
    );
}
