import i18nServer, { localeCookie } from "@/i18n/i18n.server";
import { SetPresenceCookie } from "@/module/authentication/component/SetPresenceCookie";
import { TopLoader } from "@/module/common/component/TopLoader";
import { RootProvider } from "@/module/common/provider/RootProvider";
import { rootConfig } from "@/module/root/config";
import { DetectPWA } from "@/module/wallet/component/DetectPWA";
import { isRunningInProd } from "@frak-labs/app-essentials";
import { Analytics } from "@module/component/Analytics";
import { type LoaderFunction, data } from "@remix-run/node";
import {
    Links,
    Meta,
    Outlet,
    Scripts,
    ScrollRestoration,
    useLoaderData,
    useRouteLoaderData,
} from "@remix-run/react";
import type { ReactNode } from "react";
import { useChangeLanguage } from "remix-i18next/react";

export const meta = rootConfig.meta;
export const links = rootConfig.links;
export const handle = { i18n: ["translation"] };

export const loader: LoaderFunction = async ({ request }) => {
    const locale = await i18nServer.getLocale(request);

    return data(
        { locale },
        { headers: { "Set-Cookie": await localeCookie.serialize(locale) } }
    );
};

export function Layout({ children }: { children: ReactNode }) {
    const loaderData = useRouteLoaderData<typeof loader>("root");
    const websiteId = process.env.UMAMI_WALLET_WEBSITE_ID;
    return (
        <html lang={loaderData?.locale ?? "en"}>
            <head>
                <meta charSet="utf-8" />
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1"
                />
                <Meta />
                <Links />
                {isRunningInProd && websiteId ? (
                    <Analytics websiteId={websiteId} />
                ) : null}
            </head>
            <body className="scrollbars">
                {children}
                <ScrollRestoration />
                <Scripts />
            </body>
        </html>
    );
}

export default function App() {
    const { locale } = useLoaderData<typeof loader>();
    useChangeLanguage(locale);
    return (
        <>
            <RootProvider>
                <Outlet />
            </RootProvider>
            <SetPresenceCookie />
            <TopLoader />
            <DetectPWA />
        </>
    );
}
