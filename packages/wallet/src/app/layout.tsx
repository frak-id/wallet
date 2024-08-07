import { RootProvider } from "@/module/common/provider/RootProvider";
import "@/styles/all.css";
import { getFullSessionStatus } from "@/context/interaction/action/interactionSession";
import type { Metadata, Viewport } from "next";
import { Sora } from "next/font/google";
import Script from "next/script";
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
    title: "Nexus Wallet by Frak",
    applicationName: "Nexus Wallet",
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
    keywords: ["wallet", "community", "frak", "blockchain", "nexus"],
    // TODO: Twitter, openGraph, appleWebApp?
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
                <Script id="theme" strategy="afterInteractive">
                    {`
                    function setTheme(newTheme) {
                        document.querySelector(":root").dataset.theme = newTheme;
                    }
                    const queryDark = "(prefers-color-scheme: dark)";
                    const watchSystemTheme = window.matchMedia(queryDark);
                    const themeSystem = watchSystemTheme.matches ? "dark" : "light";
                    const themeLocalStorage = JSON.parse(localStorage.getItem("theme"));
                    setTheme(themeLocalStorage ?? themeSystem);
                    watchSystemTheme.addEventListener("change", function (event) {
                        const themeLocalStorage = JSON.parse(localStorage.getItem("theme"));
                        if(themeLocalStorage === null) {
                            setTheme(event.matches ? "dark" : "light");
                        }
                    });
                `}
                </Script>
            </body>
        </html>
    );
}
