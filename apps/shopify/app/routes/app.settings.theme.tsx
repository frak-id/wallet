import screenFrakListener from "app/assets/frak-listener.png";
import { Activated } from "app/components/Activated";
import { Instructions } from "app/components/Instructions";
import { IntermediateInstall } from "app/components/IntermediateInstall";
import { LegacyInstall } from "app/components/LegacyInstall";
import { Skeleton } from "app/components/Skeleton";
import { ExternalLink } from "app/components/ui/ExternalLink";
import { useRefreshData } from "app/hooks/useRefreshData";
import { useVisibilityChange } from "app/hooks/useVisibilityChange";
import type { loader as rootLoader } from "app/routes/app";
import { getLegacyInstallDismissed } from "app/services.server/metafields";
import {
    doesThemeHasFrakActivated,
    doesThemeSupportAppEmbed,
    getMainThemeId,
} from "app/services.server/theme";
import { authenticate } from "app/shopify.server";
import { Suspense, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { LoaderFunctionArgs } from "react-router";
import { Await, useLoaderData, useRouteLoaderData } from "react-router";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const context = await authenticate.admin(request);
    const [
        isThemeHasFrakActivated,
        theme,
        legacyInstallDismissed,
        supportsAppEmbed,
    ] = await Promise.all([
        doesThemeHasFrakActivated(context),
        getMainThemeId(context),
        getLegacyInstallDismissed(context),
        doesThemeSupportAppEmbed(context),
    ]);
    return {
        isThemeHasFrakActivated,
        theme,
        legacyInstallDismissed,
        supportsAppEmbed,
    };
};

export default function SettingsThemePage() {
    const rootData = useRouteLoaderData<typeof rootLoader>("routes/app");
    const data = useLoaderData<typeof loader>();
    const isThemeHasFrakActivated = data?.isThemeHasFrakActivated;
    // Fail open, consistent with app.tsx / app._index.tsx / Stepper: never hide
    // the near-universal Listener flow on a missing/undetermined value.
    const supportsAppEmbed = data?.supportsAppEmbed ?? true;
    const { id } = data?.theme || {};
    const { t } = useTranslation();
    const shopDomain = rootData?.shop.myshopifyDomain;
    const editorUrl = `https://${shopDomain}/admin/themes/current/editor`;
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
                        ) : supportsAppEmbed ? (
                            // Intermediate theme (e.g. vintage Debut): the
                            // Listener embed works, only the in-page app block
                            // is missing — do NOT push the full manual snippet.
                            <IntermediateInstall
                                isThemeHasFrakActivated={
                                    isThemeHasFrakActivated
                                }
                                editorUrl={editorUrl}
                                listenerAppEmbedId={id ?? ""}
                            />
                        ) : (
                            <LegacyInstall
                                merchantId={merchantId}
                                walletUrl={walletUrl}
                                componentsUrl={componentsUrl}
                                businessUrl={businessUrl}
                                dismissed={data?.legacyInstallDismissed}
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
