import { TanStackDevtools } from "@tanstack/react-devtools";
import {
    createRootRoute,
    HeadContent,
    Link,
    Scripts,
    useMatches,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { Header } from "@/module/common/component/Header";
import { MainLayout } from "@/module/common/component/MainLayout";
import { Navigation } from "@/module/common/component/Navigation";
import { RootProvider } from "@/module/common/provider/RootProvider";
import "@/polyfill/bigint-serialization";
import allCss from "@/styles/all.css?url";
import colorsCss from "@/styles/colors-app.css?url";
import globalCss from "@/styles/global.css?url";

export const Route = createRootRoute({
    notFoundComponent: NotFound,
    head: () => ({
        meta: [
            {
                charSet: "utf-8",
            },
            {
                name: "viewport",
                content: "width=device-width, initial-scale=1",
            },
            {
                name: "theme-color",
                content: "#001432",
            },
            {
                title: "Frak Business Hub | Manage Your Web3 Products",
            },
            {
                name: "description",
                content:
                    "Frak Business Hub: Deploy, manage, and optimize your Web3 products. Create blockchain-based campaigns, track interactions, and grow your community in the decentralized ecosystem.",
            },
        ],
        links: [
            {
                rel: "preconnect",
                href: "https://fonts.googleapis.com",
            },
            {
                rel: "preconnect",
                href: "https://fonts.gstatic.com",
                crossOrigin: "anonymous",
            },
            {
                rel: "stylesheet",
                href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
            },
            {
                rel: "icon",
                href: "/favicons/favicon.ico",
                sizes: "32x32",
            },
            {
                rel: "icon",
                href: "/favicons/icon.svg",
                type: "image/svg+xml",
            },
            {
                rel: "apple-touch-icon",
                href: "/favicons/icon-192.png",
            },
            {
                rel: "manifest",
                href: "/manifest.json",
            },
            {
                rel: "stylesheet",
                href: globalCss,
            },
            {
                rel: "stylesheet",
                href: colorsCss,
            },
            {
                rel: "stylesheet",
                href: allCss,
            },
        ],
    }),

    shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
    const matches = useMatches();
    const isLoginPage = matches.some((match) => match.routeId === "/login");

    return (
        <html lang="en">
            <head>
                <HeadContent />
            </head>
            <body>
                <RootProvider>
                    {!isLoginPage && (
                        <>
                            <Header />
                            <Navigation />
                        </>
                    )}
                    {isLoginPage ? (
                        children
                    ) : (
                        <MainLayout>{children}</MainLayout>
                    )}
                    <TanStackDevtools
                        config={{
                            position: "bottom-right",
                        }}
                        plugins={[
                            {
                                name: "Tanstack Router",
                                render: <TanStackRouterDevtoolsPanel />,
                            },
                        ]}
                    />
                </RootProvider>
                <Scripts />
            </body>
        </html>
    );
}

function NotFound() {
    return (
        <div
            style={{
                padding: "2rem",
                textAlign: "center",
                maxWidth: "600px",
                margin: "4rem auto",
            }}
        >
            <h1 style={{ fontSize: "3rem", marginBottom: "1rem" }}>404</h1>
            <h2 style={{ marginBottom: "1rem" }}>Page Not Found</h2>
            <p style={{ color: "#94a3b8", marginBottom: "2rem" }}>
                The page you're looking for doesn't exist or has been moved.
            </p>
            <Link
                to="/dashboard"
                style={{
                    display: "inline-block",
                    padding: "0.75rem 1.5rem",
                    backgroundColor: "#0891b2",
                    color: "#ffffff",
                    borderRadius: "0.5rem",
                    textDecoration: "none",
                    fontWeight: 600,
                }}
            >
                Go to Dashboard
            </Link>
        </div>
    );
}
