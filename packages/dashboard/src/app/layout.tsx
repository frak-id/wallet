import { Fonts } from "@/module/common/component/Fonts";
import { RootProvider } from "@/module/common/provider/RootProvider";
import "@/styles/all.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "../polyfill/bigint-serialization";
import { isRunningInProd } from "@/context/common/env";

export const metadata: Metadata = {
    title: "Nexus Business Hub | Manage Your Web3 Products",
    applicationName: "Nexus Business Hub",
    description:
        "Nexus Business Hub: Deploy, manage, and optimize your Web3 products. Create blockchain-based campaigns, track interactions, and grow your community in the decentralized ecosystem.",
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
        "web3",
        "blockchain",
        "product management",
        "decentralized",
        "business dashboard",
        "campaign management",
        "community building",
        "nexus",
        "frak",
    ],
    openGraph: {
        type: "website",
        url: isRunningInProd
            ? "https://business.frak.id"
            : "https://business-dev.frak.id",
        title: "Nexus Business Hub | Manage Your Web3 Products",
        description:
            "Deploy, manage, and optimize your Web3 products with Nexus Business Hub. Create blockchain-based campaigns and grow your community.",
        siteName: "Nexus Business Hub",
    },
    twitter: {
        card: "summary_large_image",
        site: "@frak_defi",
        title: "Nexus Business Hub | Manage Your Web3 Products",
        description:
            "Deploy, manage, and optimize your Web3 products with Nexus Business Hub. Create blockchain-based campaigns and grow your community.",
    },
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
