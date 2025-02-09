import { TopLoader } from "@/module/common/component/TopLoader";
import { RootProvider } from "@/module/common/provider/RootProvider";
import { rootConfig } from "@/module/root/config";
import { DetectPWA } from "@/module/wallet/component/DetectPWA";
import { isRunningInProd } from "@frak-labs/app-essentials";
import { Analytics } from "@module/component/Analytics";
import { ReactScan } from "@module/component/ReactScan";
import { Spinner } from "@module/component/Spinner";
import type { ReactNode } from "react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";

export const meta = rootConfig.meta;
export const links = rootConfig.links;
export const handle = { i18n: ["translation"] };

export function HydrateFallback() {
    return (
        <>
            <div
                style={{
                    position: "fixed",
                    left: "50%",
                    top: "50%",
                    margin: "-8px 0 0 -8px",
                    color: "black",
                }}
            >
                <Spinner />
            </div>
            <Scripts />
        </>
    );
}

export function Layout({ children }: { children: ReactNode }) {
    const websiteId = process.env.UMAMI_WALLET_WEBSITE_ID;
    return (
        <html lang={"en"}>
            <head>
                {process.env.DEBUG === "true" && <ReactScan />}
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
    return (
        <>
            <RootProvider>
                <Outlet />
            </RootProvider>
            <TopLoader />
            <DetectPWA />
        </>
    );
}
