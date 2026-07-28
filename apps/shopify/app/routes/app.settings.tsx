import screenFrakListener from "app/assets/frak-listener.png";
import { Activated } from "app/components/Activated";
import { ConnectedShopInfo } from "app/components/ConnectedShopInfo";
import { Instructions } from "app/components/Instructions";
import { IntermediateInstall } from "app/components/IntermediateInstall";
import { LegacyInstall } from "app/components/LegacyInstall";
import { Pixel } from "app/components/Pixel";
import { Skeleton } from "app/components/Skeleton";
import { Stepper } from "app/components/Stepper";
import { ExternalLink } from "app/components/ui/ExternalLink";
import { PageHeading } from "app/components/ui/PageHeading";
import {
    CreateShopifyWebhook,
    FrakWebhook,
    WebhookList,
} from "app/components/Webhook";
import { useRefreshData } from "app/hooks/useRefreshData";
import { useVisibilityChange } from "app/hooks/useVisibilityChange";
import { getFrakWebookStatus } from "app/services.server/backendMerchant";
import { log } from "app/services.server/logger";
import {
    resolveMerchantId,
    resolveMerchantInfo,
} from "app/services.server/merchant";
import { getLegacyInstallDismissed } from "app/services.server/metafields";
import {
    doesThemeHasFrakActivated,
    doesThemeSupportAppEmbed,
    getMainThemeId,
} from "app/services.server/theme";
import { getWebhooks } from "app/services.server/webhook";
import { getWebPixel } from "app/services.server/webPixel";
import { authenticate } from "app/shopify.server";
import { Suspense, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { LoaderFunctionArgs } from "react-router";
import { Await, data, useLoaderData, useRouteLoaderData } from "react-router";
import type { loader as appLoader } from "./app";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const context = await authenticate.admin(request);

    const [merchantInfo, webPixel, merchantId, frakWebhook, webhooks, theme] =
        await Promise.all([
            resolveMerchantInfo(context),
            getWebPixel(context).catch((error) => {
                log.error({ err: error }, "web pixel fetch failed");
                return null;
            }),
            resolveMerchantId(context),
            getFrakWebookStatus(context, request),
            getWebhooks(context),
            (async () => {
                try {
                    const [
                        isThemeHasFrakActivated,
                        mainTheme,
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
                        theme: mainTheme,
                        legacyInstallDismissed,
                        supportsAppEmbed,
                    };
                } catch (error) {
                    // Degrade gracefully instead of bouncing to a full-page
                    // error. Fail open on app-embed support — it is
                    // near-universal, so never hide the Listener flow on a
                    // detection hiccup.
                    log.error({ err: error }, "settings theme loader failed");
                    return {
                        isThemeHasFrakActivated: false,
                        theme: undefined,
                        legacyInstallDismissed: false,
                        supportsAppEmbed: true,
                    };
                }
            })(),
        ]);

    return data({
        merchantInfo,
        webPixel,
        merchantId,
        frakWebhook,
        webhooks,
        theme,
    });
};

export default function SettingsIndex() {
    const { t } = useTranslation();
    const { merchantInfo, webPixel, merchantId, frakWebhook, webhooks, theme } =
        useLoaderData<typeof loader>();

    return (
        <s-page heading={t("settings.title")}>
            <PageHeading>{t("settings.title")}</PageHeading>
            <s-stack gap="large">
                <s-section heading={t("navigation.settings.general")}>
                    <s-stack gap="large">
                        {merchantInfo && (
                            <ConnectedShopInfo merchantInfo={merchantInfo} />
                        )}
                        <Stepper redirectToApp={false} />
                    </s-stack>
                </s-section>

                <s-section heading={t("navigation.settings.pixel")}>
                    <s-stack gap="small">
                        <s-box
                            paddingBlockStart="small"
                            paddingBlockEnd="small"
                        >
                            {webPixel && (
                                <s-badge tone="success">
                                    {t("pixel.connected")}
                                </s-badge>
                            )}
                            {!webPixel && (
                                <s-badge tone="critical">
                                    {t("pixel.notConnected")}
                                </s-badge>
                            )}
                        </s-box>
                        <s-text>
                            {!webPixel && t("pixel.needConnection")}
                        </s-text>
                        <s-text>
                            <Pixel id={webPixel?.id} />
                        </s-text>
                    </s-stack>
                </s-section>

                <s-section heading={t("navigation.settings.webhook")}>
                    <WebhookSection
                        webhooks={webhooks}
                        frakWebhook={frakWebhook}
                        merchantId={merchantId}
                    />
                </s-section>

                <s-stack gap="base">
                    <s-heading>{t("navigation.settings.theme")}</s-heading>
                    <ThemeSection theme={theme} />
                </s-stack>
            </s-stack>
        </s-page>
    );
}

function WebhookSection({
    webhooks,
    frakWebhook,
    merchantId,
}: {
    webhooks: Awaited<ReturnType<typeof getWebhooks>>;
    frakWebhook: Awaited<ReturnType<typeof getFrakWebookStatus>>;
    merchantId: string | null;
}) {
    const isWebhookExists = webhooks.length > 0;
    const { t } = useTranslation();

    return (
        <s-stack gap="small">
            <s-box paddingBlockStart="small" paddingBlockEnd="small">
                {isWebhookExists && (
                    <s-badge tone="success">{t("webhook.connected")}</s-badge>
                )}
                {!isWebhookExists && (
                    <s-badge tone="critical">
                        {t("webhook.notConnected")}
                    </s-badge>
                )}
            </s-box>
            <s-text>{!isWebhookExists && t("webhook.needConnection")}</s-text>
            {!isWebhookExists && (
                <s-text>
                    <CreateShopifyWebhook />
                </s-text>
            )}

            {/* Display all webhooks */}
            <WebhookList webhooks={webhooks} />

            <s-box paddingBlockStart="small" paddingBlockEnd="small">
                {frakWebhook.setup && (
                    <s-badge tone="success">
                        {t("webhook.frakConnected")}
                    </s-badge>
                )}
                {!frakWebhook.setup && (
                    <s-badge tone="critical">
                        {t("webhook.frakNotConnected")}
                    </s-badge>
                )}
            </s-box>
            {!frakWebhook.setup && (
                <s-text>{t("webhook.needFrakConnection")}</s-text>
            )}
            {merchantId && (
                <s-text>
                    <FrakWebhook
                        setup={frakWebhook.setup}
                        merchantId={merchantId}
                    />
                </s-text>
            )}
        </s-stack>
    );
}

function ThemeSection({
    theme,
}: {
    theme: {
        isThemeHasFrakActivated: boolean;
        theme?: Awaited<ReturnType<typeof getMainThemeId>>;
        legacyInstallDismissed: boolean;
        supportsAppEmbed: boolean;
    };
}) {
    const rootData = useRouteLoaderData<typeof appLoader>("routes/app");
    const isThemeHasFrakActivated = theme.isThemeHasFrakActivated;
    const supportsAppEmbed = theme.supportsAppEmbed;
    const id = theme.theme?.id;
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
                                    <ThemeNotActivated editorUrl={editorUrl} />
                                )}
                            </s-box>
                        </s-section>
                    ) : supportsAppEmbed ? (
                        // Intermediate theme (e.g. vintage Debut): the
                        // Listener embed works, only the in-page app block
                        // is missing — do NOT push the full manual snippet.
                        <IntermediateInstall
                            isThemeHasFrakActivated={isThemeHasFrakActivated}
                            editorUrl={editorUrl}
                            listenerAppEmbedId={id ?? ""}
                        />
                    ) : (
                        <LegacyInstall
                            merchantId={merchantId}
                            walletUrl={walletUrl}
                            componentsUrl={componentsUrl}
                            businessUrl={businessUrl}
                            dismissed={theme.legacyInstallDismissed}
                        />
                    )
                }
            </Await>
        </Suspense>
    );
}

function ThemeNotActivated({ editorUrl }: { editorUrl: string }) {
    const { t } = useTranslation();

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
