import { TanStackDevtools } from "@tanstack/react-devtools";
import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { Header } from "@/module/common/component/Header";
import { MainLayout } from "@/module/common/component/MainLayout";
import { Navigation } from "@/module/common/component/Navigation";
import { RootProvider } from "@/module/common/provider/RootProvider";
import allCss from "@/styles/all.css?url";
import colorsCss from "@/styles/colors-app.css?url";
import globalCss from "@/styles/global.css?url";

export const Route = createRootRoute({
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
                title: "Frak Dashboard",
            },
        ],
        links: [
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
    return (
        <html lang="en">
            <head>
                <HeadContent />
            </head>
            <body>
                <RootProvider>
                    <Header />
                    <Navigation />
                    <MainLayout>{children}</MainLayout>
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
