import { ClientOnly } from "@/module/common/component/ClientOnly";
import { RootProvider } from "@/module/common/provider/RootProvider";
import "@/styles/all.css";
import type { Metadata, Viewport } from "next";
import { Sora } from "next/font/google";
import type { ReactNode } from "react";
import styles from "./layout.module.css";

const sora = Sora({
    subsets: ["latin"],
    variable: "--font-family",
    fallback: ["--font-family-sans"],
    weight: ["400", "500", "700"],
    display: "swap",
});

export const metadata: Metadata = {
    title: "Frak Wallet",
    description:
        "POC showcasing ERC-4337 with WebAuthN inside the frak ecosystem.",
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
    manifest: "/manifest.json",
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
            <body className={sora.className}>
                <div className={"desktop"}>
                    <main className={styles.main}>
                        <div className={styles.inner}>
                            <RootProvider>
                                <ClientOnly>{children}</ClientOnly>
                            </RootProvider>
                        </div>
                    </main>
                </div>
            </body>
        </html>
    );
}
