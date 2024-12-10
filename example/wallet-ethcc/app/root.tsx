import allCssUrl from "@/styles/all.css?url";
import type { ReactNode } from "react";
import type { LinksFunction, MetaFunction } from "react-router";
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import { MainLayout } from "./module/common/component/MainLayout";
import { RootProvider } from "./module/common/provider/RootProvider";

export const meta: MetaFunction = () => {
    return [
        { title: "Frak Wallet Demo" },
        { name: "application-name", content: "Frak Wallet Demo" },
        {
            name: "description",
            content: "Simple frak wallet demo for the EthCC.",
        },
        {
            name: "author",
            content: "Frak labs",
        },
        {
            name: "author",
            content: "Rodolphe Stoclin",
        },
        {
            name: "author",
            content: "Quentin Nivelais",
        },
        {
            name: "creator",
            content: "Frak labs",
        },
        {
            name: "publisher",
            content: "Frak labs",
        },
        {
            name: "theme-color",
            content: "#001432",
        },
        {
            name: "keywords",
            content: "frak, wallet, frak-wallet, blockchain, ethcc",
        },
    ];
};

export const links: LinksFunction = () => [
    {
        rel: "icon",
        href: "/favicon.ico",
        sizes: "32x32",
    },
    {
        rel: "icon",
        href: "/icon.svg",
        type: "image/svg+xml",
    },
    {
        rel: "apple-touch-icon",
        href: "/icon-192.png",
        type: "image/png",
    },
    {
        rel: "manifest",
        href: "/manifest.json",
        crossOrigin: "use-credentials",
    },
    {
        rel: "author",
        href: "https://frak.id/",
    },
    {
        rel: "author",
        href: "https://github.com/srod",
    },
    {
        rel: "author",
        href: "https://github.com/KONFeature",
    },
    { rel: "preconnect", href: "https://fonts.googleapis.com" },
    {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
    },
    {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
    },
    {
        rel: "stylesheet",
        href: allCssUrl,
    },
];

export function Layout({ children }: { children: ReactNode }) {
    return (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1"
                />
                <Meta />
                <Links />
            </head>
            <body>
                {children}
                <ScrollRestoration />
                <Scripts />
            </body>
        </html>
    );
}

export default function App() {
    return (
        <RootProvider>
            <MainLayout>
                <Outlet />
            </MainLayout>
        </RootProvider>
    );
}
