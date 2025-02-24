import allCssUrl from "@/styles/all.css?url";
import { ReactScan } from "@module/component/ReactScan";
import { Spinner } from "@module/component/Spinner";
import { loadPolyfills } from "@module/utils/polyfills";
import type { ReactNode } from "react";
import type { LinksFunction, MetaFunction } from "react-router";
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import { MainLayout } from "./module/common/component/MainLayout";
import { RootProvider } from "./module/common/provider/RootProvider";

loadPolyfills();

export const meta: MetaFunction = () => {
    return [
        { title: "Good Vibes by Frak" },
        { name: "application-name", content: "Good Vibes - Frak" },
        {
            name: "description",
            content: "Good Vibes website using Frak Wallet.",
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
            content: "#ffffff",
        },
        {
            name: "keywords",
            content: "frak, wallet, frak-wallet, blockchain",
        },
        {
            name: "google",
            content: "notranslate",
        },
    ];
};

export const links: LinksFunction = () => [
    {
        rel: "icon",
        href: "/favicon.ico",
        sizes: "48x48",
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
        href: "https://fonts.googleapis.com/css2?family=Merriweather:wght@700&family=Roboto:wght@400;500;700&display=swap",
    },
    {
        rel: "stylesheet",
        href: allCssUrl,
    },
];

export function HydrateFallback() {
    return (
        <>
            <div
                style={{
                    position: "fixed",
                    left: "50%",
                    top: "50%",
                    margin: "-8px 0 0 -8px",
                }}
            >
                <Spinner />
            </div>
            <Scripts />
        </>
    );
}

export function Layout({ children }: { children: ReactNode }) {
    return (
        <html lang="en">
            <head>
                {process.env.DEBUG === "true" && <ReactScan />}
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
