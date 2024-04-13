import { getSession } from "@/context/session/action/session";
import { RootProvider } from "@/module/common/provider/RootProvider";
import "@/styles/all.css";
import type { Metadata, Viewport } from "next";
import { Sora } from "next/font/google";
import Script from "next/script";
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

export default async function RootLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    // Check if a user is logged in or not
    const session = await getSession();

    return (
        <html lang="en" suppressHydrationWarning>
            <body className={`scrollbars ${sora.className}`}>
                <div className={"desktop scrollbars"}>
                    <main className={styles.main}>
                        <div className={styles.inner}>
                            <RootProvider session={session}>
                                {children}
                            </RootProvider>
                        </div>
                    </main>
                </div>
                <Script id="theme" strategy="beforeInteractive">
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
