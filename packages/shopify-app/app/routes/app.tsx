import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { doesThemeSupportBlock } from "app/services.server/theme";
import { RootProvider } from "../providers/RootProvider";
import { authenticate } from "../shopify.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const context = await authenticate.admin(request);
    const isThemeSupported = await doesThemeSupportBlock(context);

    return {
        apiKey: process.env.SHOPIFY_API_KEY || "",
        isThemeSupported,
    };
};

export default function App() {
    const { apiKey, isThemeSupported } = useLoaderData<typeof loader>();
    return (
        <AppProvider isEmbeddedApp apiKey={apiKey}>
            <RootProvider>
                <NavMenu>
                    <Link to="/app" rel="home">
                        Home
                    </Link>
                    {isThemeSupported && (
                        <>
                            <Link to="/app/pixel">Application pixel</Link>
                            <Link to="/app/webhook">Webhook</Link>
                        </>
                    )}
                </NavMenu>
                <Outlet />
            </RootProvider>
        </AppProvider>
    );
}

// Shopify needs Remix to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
    return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
    return boundary.headers(headersArgs);
};
