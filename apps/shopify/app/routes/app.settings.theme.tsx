import screenFrakListener from "app/assets/frak-listener.png";
import { Activated } from "app/components/Activated";
import { Instructions } from "app/components/Instructions";
import { LegacyInstall } from "app/components/LegacyInstall";
import { Skeleton } from "app/components/Skeleton";
import { ExternalLink } from "app/components/ui/ExternalLink";
import { useRefreshData } from "app/hooks/useRefreshData";
import { useVisibilityChange } from "app/hooks/useVisibilityChange";
import type { loader as rootLoader } from "app/routes/app";
import {
    doesThemeHasFrakActivated,
    getMainThemeId,
} from "app/services.server/theme";
import { authenticate } from "app/shopify.server";
import { Suspense, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { LoaderFunctionArgs } from "react-router";
import { Await, useLoaderData, useRouteLoaderData } from "react-router";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const context = await authenticate.admin(request);
    const isThemeHasFrakActivated = await doesThemeHasFrakActivated(context);
    const theme = await getMainThemeId(context);
    return { isThemeHasFrakActivated, theme };
};

export default function SettingsThemePage() {
    const rootData = useRouteLoaderData<typeof rootLoader>("routes/app");
    const data = useLoaderData<typeof loader>();
    const isThemeHasFrakActivated = data?.isThemeHasFrakActivated;
    const { id } = data?.theme || {};
    const { t } = useTranslation();
    const editorUrl = `https://${rootData?.shop.myshopifyDomain}/admin/themes/current/editor`;
    const refresh = useRefreshData();
    const isThemeSupportedPromise = rootData?.isThemeSupportedPromise;
    const merchantId = rootData?.merchantId ?? null;
    const walletUrl = rootData?.walletUrl ?? "";
    const componentsUrl = rootData?.componentsUrl ?? "";
    const businessUrl = rootData?.businessUrl ?? "";

    useVisibilityChange(
        useCallback(() => {
            refresh();
        }, [refresh])
    );

    return (
        <s-stack gap="large">
            <Suspense fallback={<Skeleton />}>
                <Await resolve={isThemeSupportedPromise}>
                    {(isThemeSupported) =>
                        isThemeSupported ? (
                            <s-section>
                                <s-box paddingBlockStart="small">
                                    {isThemeHasFrakActivated && (
                                        <>
                                            <Activated
                                                text={t("theme.connected")}
                                            />
                                            <s-box paddingBlockStart="small">
                                                <ExternalLink
                                                    href={`${editorUrl}?context=apps&appEmbed=${id}/listener`}
                                                >
                                                    {t("theme.link")}
                                                </ExternalLink>
                                            </s-box>
                                        </>
                                    )}
                                    {!isThemeHasFrakActivated && (
                                        <ThemeNotActivated />
                                    )}
                                </s-box>
                            </s-section>
                        ) : (
                            <LegacyInstall
                                merchantId={merchantId}
                                walletUrl={walletUrl}
                                componentsUrl={componentsUrl}
                                businessUrl={businessUrl}
                            />
                        )
                    }
                </Await>
            </Suspense>
        </s-stack>
    );
}

function ThemeNotActivated() {
    const rootData = useRouteLoaderData<typeof rootLoader>("routes/app");
    const { t } = useTranslation();
    const editorUrl = `https://${rootData?.shop?.myshopifyDomain}/admin/themes/current/editor`;

    return (
        <Instructions
            badgeText={t("theme.notConnected")}
            todoText={t("theme.todo")}
            image={screenFrakListener}
        >
            <ExternalLink href={`${editorUrl}?context=apps`}>
                {t("theme.link")}
            </ExternalLink>
        </Instructions>
    );
}
