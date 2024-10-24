import type { LinksFunction } from "@remix-run/node";
import {
    Links,
    Meta,
    Outlet,
    Scripts,
    ScrollRestoration,
    json,
    useLoaderData,
} from "@remix-run/react";
import type { ReactNode } from "react";
import { MainLayout } from "./module/common/component/MainLayout";
import { RootProvider } from "./module/common/provider/RootProvider";
import "@/styles/all.css";

export const links: LinksFunction = () => [
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
];

export async function loader() {
    return json({
        ENV: {
            BACKEND_URL: process.env.BACKEND_URL,
            FRAK_WALLET_URL: "https://localhost:3000",
        },
    });
}

export function Layout({ children }: { children: ReactNode }) {
    const data = useLoaderData<typeof loader>();
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
                <script
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation>
                    dangerouslySetInnerHTML={{
                        __html: `process = { env: ${JSON.stringify(data.ENV)} }`,
                    }}
                />
                <Scripts />
            </body>
        </html>
    );
}

export default function App() {
    return <Outlet />;
}
