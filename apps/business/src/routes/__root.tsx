import { ContentBlock } from "@frak-labs/design-system/components/ContentBlock";
import { Text } from "@frak-labs/design-system/components/Text";
import { TanStackDevtools } from "@tanstack/react-devtools";
import {
    createRootRoute,
    type ErrorComponentProps,
    Outlet,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { useTranslation } from "react-i18next";
import { NotFound } from "@/module/common/component/NotFound";
import { RootProvider } from "@/module/common/provider/RootProvider";
import "@/polyfill/bigint-serialization";
import "@/styles/all";
import "nprogress/nprogress.css";
import {
    errorContainer,
    errorContainerMessage,
    errorContainerStack,
    errorContainerTitle,
} from "./__root.css";

export const Route = createRootRoute({
    component: RootComponent,
    errorComponent: ErrorComponent,
    notFoundComponent: NotFound,
});

function ErrorComponent({ error }: ErrorComponentProps) {
    const { t } = useTranslation();
    // A throw site can raise any value, so `error` is `unknown`; only a real
    // Error carries a message and a stack worth rendering.
    const asError = error instanceof Error ? error : undefined;
    const message = asError?.message || t("errors.boundary.message");
    return (
        <ContentBlock maxWidth="600px" className={errorContainer}>
            <Text as="h1" variant="display" className={errorContainerTitle}>
                {t("errors.generic.title")}
            </Text>
            <Text
                variant="body"
                color="tertiary"
                className={errorContainerMessage}
            >
                {message}
            </Text>
            {import.meta.env.DEV && asError?.stack && (
                <pre className={errorContainerStack}>{asError.stack}</pre>
            )}
        </ContentBlock>
    );
}

function RootComponent() {
    return (
        <RootProvider>
            <Outlet />
            {import.meta.env.DEV && (
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
            )}
        </RootProvider>
    );
}
