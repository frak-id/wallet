import allCssUrl from "@/styles/all.css?url";
import type { LinksFunction, MetaFunction } from "@remix-run/node";
import {
    Links,
    Meta,
    Outlet,
    Scripts,
    ScrollRestoration,
    json,
    useRouteLoaderData,
} from "@remix-run/react";
import type { ReactNode } from "react";
import { Config } from "sst/node/config";
import { MainLayout } from "./module/common/component/MainLayout";
import { RootProvider } from "./module/common/provider/RootProvider";

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
    ];
};

export const links: LinksFunction = () => [
    {
        rel: "icon",
        href: "/favicons/favicon.ico",
        sizes: "48x48",
    },
    {
        rel: "apple-touch-icon",
        href: "/favicons/icon-192.png",
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

export async function loader() {
    return json({
        ENV: {
            FRAK_WALLET_URL:
                Config.FRAK_WALLET_URL ?? "https://wallet-dev.frak.id",
            BACKEND_URL: Config.BACKEND_URL ?? "https://backend-dev.frak.id",
        },
    });
}

export function Layout({ children }: { children: ReactNode }) {
    const data = useRouteLoaderData<typeof loader>("root");
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
                <RootProvider>
                    <MainLayout>{children}</MainLayout>
                </RootProvider>
                <ScrollRestoration />
                {data?.ENV && (
                    <script
                        // biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation>
                        dangerouslySetInnerHTML={{
                            __html: `process = { env: ${JSON.stringify(data.ENV)} }`,
                        }}
                    />
                )}
                <Scripts />
            </body>
        </html>
    );
}

export default function App() {
    return <Outlet />;
}
