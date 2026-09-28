import { useVisibilityChange } from "app/hooks/useVisibilityChange";
import type { loader as appLoader } from "app/routes/app";
import type { OnboardingStepData } from "app/utils/onboarding";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useRouteLoaderData } from "react-router";
import screenShareButton from "../../assets/share-button.png";
import { useRefreshData } from "../../hooks/useRefreshData";
import { ExternalButton } from "../ui/ExternalLink";

/**
 * "Finish your setup" cards for the optional storefront blocks: share button,
 * banner and ambassador page. Each card hides once its block is detected.
 * Tab visibility triggers a refresh so theme-editor changes show up.
 */
export function OptionalSetup({
    onboardingData,
}: {
    onboardingData: OnboardingStepData;
}) {
    const { t } = useTranslation();
    const refresh = useRefreshData();

    useVisibilityChange(
        useCallback(() => {
            refresh();
        }, [refresh])
    );

    const showShareButton =
        !onboardingData.isThemeHasFrakButton &&
        Boolean(onboardingData.firstProduct);
    const showBanner = !onboardingData.isThemeHasFrakBanner;
    const showAmbassador = !onboardingData.isThemeHasFrakAmbassador;

    if (!showShareButton && !showBanner && !showAmbassador) return null;

    return (
        <s-section>
            <s-stack gap="base">
                <s-heading>{t("optionalSetup.title")}</s-heading>
                <s-text>{t("optionalSetup.description")}</s-text>
                <s-stack gap="base">
                    {showShareButton && (
                        <ShareButtonCard
                            productHandle={onboardingData.firstProduct?.handle}
                        />
                    )}
                    {showBanner && <BannerCard />}
                    {showAmbassador && <AmbassadorCard />}
                </s-stack>
            </s-stack>
        </s-section>
    );
}

function useAdminUrl(): string {
    const rootData = useRouteLoaderData<typeof appLoader>("routes/app");
    return `https://${rootData?.shop?.myshopifyDomain}/admin`;
}

function useThemeEditorUrl(): string {
    return `${useAdminUrl()}/themes/current/editor`;
}

function ShareButtonCard({ productHandle }: { productHandle?: string }) {
    const { t } = useTranslation();
    const editorUrl = useThemeEditorUrl();
    const href = productHandle
        ? `${editorUrl}?previewPath=/products/${productHandle}`
        : null;

    return (
        <s-box background="subdued" padding="base">
            <s-stack gap="base">
                <s-heading>{t("optionalSetup.shareButton.title")}</s-heading>
                <s-text>{t("optionalSetup.shareButton.description")}</s-text>
                <img
                    src={screenShareButton}
                    alt=""
                    style={{ maxWidth: "320px" }}
                />
                {href && (
                    <ExternalButton variant="primary" href={href}>
                        {t("optionalSetup.shareButton.cta")}
                    </ExternalButton>
                )}
            </s-stack>
        </s-box>
    );
}

function BannerCard() {
    const { t } = useTranslation();
    const editorUrl = useThemeEditorUrl();

    return (
        <s-box background="subdued" padding="base">
            <s-stack gap="base">
                <s-heading>{t("optionalSetup.banner.title")}</s-heading>
                <s-text>{t("optionalSetup.banner.description")}</s-text>
                <ExternalButton
                    variant="primary"
                    href={`${editorUrl}?context=apps`}
                >
                    {t("optionalSetup.banner.cta")}
                </ExternalButton>
            </s-stack>
        </s-box>
    );
}

function AmbassadorCard() {
    const { t } = useTranslation();
    const adminUrl = useAdminUrl();
    const editorUrl = useThemeEditorUrl();

    // No `addAppBlockId` deep link: it could only target the default page
    // template, which would put the ambassador page on every page.
    return (
        <s-box background="subdued" padding="base">
            <s-stack gap="base">
                <s-heading>{t("optionalSetup.ambassador.title")}</s-heading>
                <s-text>{t("optionalSetup.ambassador.description")}</s-text>
                <s-text>{t("optionalSetup.ambassador.step1")}</s-text>
                <ExternalButton
                    variant="primary"
                    href={`${adminUrl}/pages/new`}
                >
                    {t("optionalSetup.ambassador.step1Cta")}
                </ExternalButton>
                <s-text>{t("optionalSetup.ambassador.step2")}</s-text>
                <ExternalButton
                    variant="secondary"
                    href={`${editorUrl}?template=page`}
                >
                    {t("optionalSetup.ambassador.step2Cta")}
                </ExternalButton>
                <s-text>{t("optionalSetup.ambassador.step3")}</s-text>
            </s-stack>
        </s-box>
    );
}
