import { Text } from "@frak-labs/design-system/components/Text";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { useTranslation } from "react-i18next";
import { RootProvider } from "@/module/common/provider/RootProvider";
import "@/polyfill/bigint-serialization";
import "@/styles/all";
import "nprogress/nprogress.css";
import {
    errorContainer,
    errorContainerMessage,
    errorContainerStack,
    errorContainerTitle,
    notFoundLink,
    notFoundMessage,
    notFoundSubtitle,
    notFoundTitle,
} from "./__root.css";

export const Route = createRootRoute({
    component: RootComponent,
    errorComponent: ErrorComponent,
    notFoundComponent: NotFound,
});

function ErrorComponent({ error }: { error: Error }) {
    const { t } = useTranslation();
    return (
        <div className={errorContainer}>
            <Text as="h1" variant="display" className={errorContainerTitle}>
                {t("errors.generic.title")}
            </Text>
            <Text
                variant="body"
                color="tertiary"
                className={errorContainerMessage}
            >
                {error.message}
            </Text>
            {import.meta.env.DEV && (
                <pre className={errorContainerStack}>{error.stack}</pre>
            )}
        </div>
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

function NotFound() {
    const { t } = useTranslation();
    return (
        <div className={errorContainer}>
            <Text as="h1" variant="display1" className={notFoundTitle}>
                404
            </Text>
            <Text as="h2" variant="heading2" className={notFoundSubtitle}>
                {t("errors.notFound.title")}
            </Text>
            <Text variant="body" color="tertiary" className={notFoundMessage}>
                {t("errors.notFound.description")}
            </Text>
            <Link to="/dashboard" className={notFoundLink}>
                {t("errors.notFound.action")}
            </Link>
        </div>
    );
}
